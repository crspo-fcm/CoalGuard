const express = require("express");
const crypto = require("crypto");

const router = express.Router();

const db = require("../database/database");

const { verifyLocation } = require("../services/gps");

const {
    calculateRisk,
    getDatabaseRiskLevel
} = require("../services/riskDetection");


// ============================================================
// SUBMIT A NEW INSPECTION
// POST /api/inspections
// ============================================================

router.post("/", (req, res) => {
    try {

        const {
            inspector_id,
            location_id,
            latitude,
            longitude,
            observation
        } = req.body;


        // ====================================================
        // VALIDATE INPUT
        // ====================================================

        if (
            !inspector_id ||
            !location_id ||
            latitude === undefined ||
            longitude === undefined
        ) {
            return res.status(400).json({
                success: false,
                message: "Missing required inspection information."
            });
        }


        // ====================================================
        // FIND REGISTERED LOCATION
        // ====================================================

        const location = db
            .prepare(`
                SELECT *
                FROM locations
                WHERE id = ?
            `)
            .get(Number(location_id));


        if (!location) {
            return res.status(404).json({
                success: false,
                message: "Mine location not found."
            });
        }


        // ====================================================
        // FIND EXACT REGISTERED MINE
        // ====================================================

        let linkedMine = null;

        if (location.mine_id) {
            linkedMine = db
                .prepare(`
                    SELECT
                        id,
                        name,
                        company,
                        subsidiary,
                        state,
                        coalfield,
                        mine_type,
                        latitude,
                        longitude,
                        status,
                        compliance
                    FROM mines
                    WHERE id = ?
                `)
                .get(Number(location.mine_id));
        }


        // ====================================================
        // GPS VERIFICATION
        // ====================================================

        const gpsResult = verifyLocation(
            Number(latitude),
            Number(longitude),
            location.latitude,
            location.longitude
        );


        // ====================================================
        // REJECT IF OUTSIDE 30 METRES
        // ====================================================

        if (!gpsResult.verified) {

            db.prepare(`
                INSERT INTO fraud_alerts (
                    inspector_id,
                    location_id,
                    latitude,
                    longitude,
                    distance_meters,
                    reason
                )
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(
                Number(inspector_id),
                Number(location_id),
                Number(latitude),
                Number(longitude),
                gpsResult.distance,
                "Inspector was outside the permitted 30-meter radius."
            );


            return res.status(403).json({
                success: false,
                message:
                    "Inspection rejected: Inspector is outside the 30-meter site boundary.",
                verification: gpsResult,
                mine: linkedMine || null
            });
        }


        // ====================================================
        // RISK ENGINE
        // ====================================================

        const riskAnalysis = calculateRisk(
            observation || ""
        );


        const detailedRiskLevel =
            riskAnalysis.level;


        const riskScore =
            Number(riskAnalysis.score) || 0;


        const riskFactors =
            riskAnalysis.factors || [];


        const riskFactorsJSON =
            JSON.stringify(riskFactors);


        const riskRecommendation =
            riskAnalysis.recommendation ||
            "No immediate action required.";


        // ====================================================
        // DATABASE COMPATIBILITY
        //
        // SQLite accepts:
        // GREEN / RED
        //
        // Detailed four-level risk is preserved through:
        // riskLevel
        // riskScore
        // riskFactors
        // recommendation
        // ====================================================

        const databaseRiskLevel =
            getDatabaseRiskLevel(
                detailedRiskLevel
            );


        // ====================================================
        // SAVE INSPECTION
        // ====================================================

        const result = db.prepare(`
            INSERT INTO inspections (
                inspector_id,
                location_id,
                latitude,
                longitude,
                distance_meters,
                observation,
                risk_level,
                risk_score,
                risk_factors,
                risk_recommendation,
                status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            Number(inspector_id),
            Number(location_id),
            Number(latitude),
            Number(longitude),
            gpsResult.distance,
            observation || "",
            databaseRiskLevel,
            riskScore,
            riskFactorsJSON,
            riskRecommendation,
            "OPEN"
        );


        const inspectionId =
            Number(result.lastInsertRowid);


        // ====================================================
        // AUTOMATIC VIOLATION CREATION
        //
        // GREEN = no violation
        // MEDIUM / HIGH / CRITICAL = violation
        // ====================================================

        let createdViolation = null;


        if (detailedRiskLevel !== "GREEN") {

            // =================================================
            // DETERMINE PRIMARY RISK FACTOR
            // =================================================

            let primaryFactor =
                "Unsafe condition detected";


            if (riskFactors.length > 0) {

                primaryFactor =
                    riskFactors
                        .map((item) => {

                            if (
                                typeof item === "string"
                            ) {
                                return item;
                            }

                            return item.factor || "";
                        })
                        .filter(Boolean)
                        .join(", ");
            }


            // =================================================
            // DETERMINE CATEGORY
            // =================================================

            let category =
                "General Safety";


            const factorText =
                primaryFactor.toLowerCase();


            if (
                factorText.includes("gas")
            ) {
                category = "Gas Safety";
            }

            else if (
                factorText.includes("fire") ||
                factorText.includes("explosion")
            ) {
                category = "Fire & Explosion";
            }

            else if (
                factorText.includes("structural") ||
                factorText.includes("crack") ||
                factorText.includes("collapse")
            ) {
                category = "Structural Safety";
            }

            else if (
                factorText.includes("flood") ||
                factorText.includes("water")
            ) {
                category = "Environmental Safety";
            }

            else if (
                factorText.includes("ventilation")
            ) {
                category = "Ventilation";
            }

            else if (
                factorText.includes("equipment") ||
                factorText.includes("helmet") ||
                factorText.includes("ppe")
            ) {
                category = "PPE / Safety Equipment";
            }

            else if (
                factorText.includes("injury")
            ) {
                category = "Worker Safety";
            }


            // =================================================
            // CREATE VIOLATION
            // =================================================

            const violationResult = db.prepare(`
                INSERT INTO violations (
                    inspection_id,
                    title,
                    description,
                    category,
                    severity,
                    reported_by,
                    assigned_to,
                    corrective_action,
                    due_date,
                    status
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                inspectionId,

                `Automatic Risk Violation - ${detailedRiskLevel}`,

                `${primaryFactor}. Observation: ${
                    observation || "No observation provided."
                }`,

                category,

                detailedRiskLevel,

                "CoalGuard AI Risk Engine",

                "",

                riskRecommendation,

                "",

                "Reported"
            );


            const violationId =
                Number(violationResult.lastInsertRowid);


            // =================================================
            // CREATE AUDIT LOG
            // =================================================

            try {

                const previous =
                    db.prepare(`
                        SELECT hash
                        FROM audit_logs
                        ORDER BY id DESC
                        LIMIT 1
                    `).get();


                const previousHash =
                    previous && previous.hash
                        ? previous.hash
                        : "GENESIS";


                const timestamp =
                    new Date().toISOString();


                const auditAction =
                    "VIOLATION_REPORTED";


                const auditActor =
                    "CoalGuard AI Risk Engine";


                const auditDescription =
                    `Automatic violation #${violationId} created from inspection #${inspectionId}.`;


                const hashInput =
                    `${previousHash}|` +
                    `${inspectionId}|` +
                    `${violationId}|` +
                    `${auditAction}|` +
                    `${auditActor}|` +
                    `${auditDescription}|` +
                    `${timestamp}`;


                const hash =
                    crypto
                        .createHash("sha256")
                        .update(hashInput)
                        .digest("hex");


                db.prepare(`
                    INSERT INTO audit_logs (
                        inspection_id,
                        violation_id,
                        action,
                        actor,
                        description,
                        timestamp,
                        previous_hash,
                        hash
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `).run(
                    inspectionId,
                    violationId,
                    auditAction,
                    auditActor,
                    auditDescription,
                    timestamp,
                    previousHash,
                    hash
                );

            } catch (auditError) {

                console.error(
                    "Automatic violation audit error:",
                    auditError
                );
            }


            // =================================================
            // FETCH CREATED VIOLATION
            // =================================================

            createdViolation =
                db.prepare(`
                    SELECT *
                    FROM violations
                    WHERE id = ?
                `).get(violationId);
        }


        // ====================================================
        // SUCCESS RESPONSE
        // ====================================================

        res.status(201).json({

            success: true,

            message:
                "Inspection submitted successfully.",

            inspection: {

                id:
                    inspectionId,

                location:
                    location.name,

                locationId:
                    Number(location.id),

                mineId:
                    location.mine_id
                        ? Number(location.mine_id)
                        : null,

                mineName:
                    linkedMine
                        ? linkedMine.name
                        : null,

                mineCompany:
                    linkedMine
                        ? linkedMine.company
                        : null,

                mineState:
                    linkedMine
                        ? linkedMine.state
                        : null,

                latitude:
                    Number(latitude),

                longitude:
                    Number(longitude),

                distance:
                    gpsResult.distance,

                // Four-level risk
                riskLevel:
                    detailedRiskLevel,

                // SQLite-compatible risk
                databaseRiskLevel:
                    databaseRiskLevel,

                riskScore:
                    riskScore,

                riskFactors:
                    riskFactors,

                recommendation:
                    riskRecommendation,

                status:
                    "OPEN",

                violationCreated:
                    createdViolation !== null,

                violation:
                    createdViolation
            }
        });


    } catch (error) {

        console.error(
            "Inspection error:",
            error
        );


        res.status(500).json({
            success: false,
            message:
                "Failed to submit inspection."
        });
    }
});


// ============================================================
// DELETE A FRAUD ALERT
// DELETE /api/inspections/fraud-alerts/:id
//
// IMPORTANT: This route comes BEFORE /:id.
// ============================================================

router.delete("/fraud-alerts/:id", (req, res) => {

    try {

        const alertId =
            Number(req.params.id);


        if (
            !Number.isInteger(alertId) ||
            alertId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid fraud alert ID."
            });
        }


        const alert =
            db.prepare(`
                SELECT id
                FROM fraud_alerts
                WHERE id = ?
            `).get(alertId);


        if (!alert) {
            return res.status(404).json({
                success: false,
                message: "Fraud alert not found."
            });
        }


        db.prepare(`
            DELETE FROM fraud_alerts
            WHERE id = ?
        `).run(alertId);


        res.json({
            success: true,
            message:
                `Fraud alert #${alertId} deleted successfully.`,
            deleted_id:
                alertId
        });


    } catch (error) {

        console.error(
            "Delete fraud alert error:",
            error
        );


        res.status(500).json({
            success: false,
            message:
                "Failed to delete fraud alert."
        });
    }
});


// ============================================================
// GET ALL FRAUD ALERTS
// GET /api/inspections/fraud-alerts
// ============================================================

router.get("/fraud-alerts", (req, res) => {

    try {

        const alerts =
            db.prepare(`
                SELECT
                    fraud_alerts.id,
                    fraud_alerts.inspector_id,
                    fraud_alerts.location_id,
                    fraud_alerts.latitude,
                    fraud_alerts.longitude,
                    fraud_alerts.distance_meters,
                    fraud_alerts.reason,
                    fraud_alerts.created_at,

                    users.name AS inspector_name,

                    locations.name AS location_name,
                    locations.mine_id AS mine_id,

                    mines.name AS mine_name,
                    mines.company AS mine_company,
                    mines.state AS mine_state

                FROM fraud_alerts

                LEFT JOIN users
                    ON fraud_alerts.inspector_id = users.id

                LEFT JOIN locations
                    ON fraud_alerts.location_id = locations.id

                LEFT JOIN mines
                    ON locations.mine_id = mines.id

                ORDER BY
                    fraud_alerts.created_at DESC
            `)
            .all();


        res.json({

            success: true,

            count:
                alerts.length,

            alerts:
                alerts
        });


    } catch (error) {

        console.error(
            "Fraud alerts error:",
            error
        );


        res.status(500).json({
            success: false,
            message:
                "Failed to fetch fraud alerts."
        });
    }
});


// ============================================================
// GET ALL INSPECTIONS
// GET /api/inspections
// ============================================================

router.get("/", (req, res) => {

    try {

        const inspections =
            db.prepare(`
                SELECT

                    inspections.id,

                    inspections.inspector_id,

                    inspections.location_id,

                    users.name AS inspector_name,

                    users.email AS inspector_email,

                    locations.name AS location_name,

                    locations.mine_id AS mine_id,

                    mines.name AS mine_name,

                    mines.company AS mine_company,

                    mines.subsidiary AS mine_subsidiary,

                    mines.state AS mine_state,

                    mines.coalfield AS mine_coalfield,

                    mines.mine_type AS mine_type,

                    mines.latitude AS mine_latitude,

                    mines.longitude AS mine_longitude,

                    mines.status AS mine_status,

                    mines.compliance AS mine_compliance,

                    inspections.latitude,

                    inspections.longitude,

                    inspections.distance_meters,

                    inspections.observation,

                    inspections.risk_level,

                    inspections.risk_score,

                    inspections.risk_factors,

                    inspections.risk_recommendation,

                    inspections.status,

                    inspections.created_at

                FROM inspections

                JOIN users
                    ON inspections.inspector_id = users.id

                JOIN locations
                    ON inspections.location_id = locations.id

                LEFT JOIN mines
                    ON locations.mine_id = mines.id

                ORDER BY
                    inspections.created_at DESC
            `)
            .all();


        // ====================================================
        // PARSE RISK FACTORS
        // ====================================================

        const formattedInspections =
            inspections.map((inspection) => {

                let factors = [];

                try {

                    factors =
                        inspection.risk_factors
                            ? JSON.parse(
                                inspection.risk_factors
                            )
                            : [];

                } catch (error) {

                    factors = [];
                }


                return {

                    ...inspection,

                    mine_id:
                        inspection.mine_id !== null
                            ? Number(inspection.mine_id)
                            : null,

                    risk_factors:
                        factors
                };
            });


        res.json({

            success: true,

            count:
                formattedInspections.length,

            inspections:
                formattedInspections
        });


    } catch (error) {

        console.error(
            "Inspection history error:",
            error
        );


        res.status(500).json({
            success: false,
            message:
                "Failed to retrieve inspection history."
        });
    }
});


// ============================================================
// DELETE AN INSPECTION
// DELETE /api/inspections/:id
// ============================================================

router.delete("/:id", (req, res) => {

    try {

        const inspectionId =
            Number(req.params.id);


        if (
            !Number.isInteger(inspectionId) ||
            inspectionId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid inspection ID."
            });
        }


        // ====================================================
        // CHECK INSPECTION
        // ====================================================

        const inspection =
            db.prepare(`
                SELECT id
                FROM inspections
                WHERE id = ?
            `).get(inspectionId);


        if (!inspection) {
            return res.status(404).json({
                success: false,
                message: "Inspection not found."
            });
        }


        // ====================================================
        // DELETE AUDIT RECORDS
        // ====================================================

        db.prepare(`
            DELETE FROM audit_logs
            WHERE inspection_id = ?
        `).run(inspectionId);


        // ====================================================
        // DELETE RELATED VIOLATIONS
        // ====================================================

        db.prepare(`
            DELETE FROM violations
            WHERE inspection_id = ?
        `).run(inspectionId);


        // ====================================================
        // DELETE INSPECTION
        // ====================================================

        db.prepare(`
            DELETE FROM inspections
            WHERE id = ?
        `).run(inspectionId);


        res.json({

            success: true,

            message:
                `Inspection #${inspectionId} deleted successfully.`,

            deleted_id:
                inspectionId
        });


    } catch (error) {

        console.error(
            "Delete inspection error:",
            error
        );


        res.status(500).json({
            success: false,
            message:
                "Failed to delete inspection."
        });
    }
});


// ============================================================
// EXPORT ROUTER
// ============================================================

module.exports = router;