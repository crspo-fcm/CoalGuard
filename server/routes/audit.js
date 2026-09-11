const express = require("express");
const crypto = require("crypto");
const db = require("../database/database");

const router = express.Router();

/*
=========================================================
HASH FUNCTION
=========================================================
IMPORTANT:
This order MUST exactly match violations.js:

previousHash
inspectionId
violationId
action
actor
description
timestamp
=========================================================
*/

function calculateHash(log, previousHash) {
    const hashInput =
        `${previousHash}|` +
        `${log.inspection_id || ""}|` +
        `${log.violation_id || ""}|` +
        `${log.action || ""}|` +
        `${log.actor || ""}|` +
        `${log.description || ""}|` +
        `${log.timestamp || ""}`;

    return crypto
        .createHash("sha256")
        .update(hashInput)
        .digest("hex");
}


/*
=========================================================
GET ALL AUDIT LOGS
GET /api/audit
=========================================================
*/

router.get("/", (req, res) => {
    try {
        const logs = db.prepare(`
            SELECT *
            FROM audit_logs
            ORDER BY id DESC
        `).all();

        res.json({
            success: true,
            logs
        });

    } catch (error) {
        console.error(
            "GET /api/audit error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Failed to load audit logs"
        });
    }
});


/*
=========================================================
VERIFY AUDIT CHAIN
GET /api/audit/verify
=========================================================
*/

router.get("/verify", (req, res) => {
    try {
        const logs = db.prepare(`
            SELECT *
            FROM audit_logs
            ORDER BY id ASC
        `).all();

        let previousHash = "GENESIS";

        for (const log of logs) {

            /*
            Check connection to previous record
            */
            if (log.previous_hash !== previousHash) {
                return res.json({
                    success: true,
                    valid: false,
                    broken_at: log.id,
                    reason:
                        "Previous hash link is invalid."
                });
            }

            /*
            Recalculate hash using EXACTLY
            the same order as violations.js
            */
            const expectedHash =
                calculateHash(
                    log,
                    previousHash
                );

            /*
            Compare calculated hash
            with stored hash
            */
            if (log.hash !== expectedHash) {
                return res.json({
                    success: true,
                    valid: false,
                    broken_at: log.id,
                    reason:
                        "Stored SHA-256 hash does not match."
                });
            }

            /*
            Current record becomes the
            previous record for the next one
            */
            previousHash = log.hash;
        }

        res.json({
            success: true,
            valid: true,
            total_records: logs.length,
            message:
                "Audit chain verified successfully."
        });

    } catch (error) {
        console.error(
            "GET /api/audit/verify error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Failed to verify audit chain"
        });
    }
});


/*
=========================================================
AUDIT STATISTICS
GET /api/audit/stats
=========================================================
*/

router.get("/stats", (req, res) => {
    try {

        const total = db.prepare(`
            SELECT COUNT(*) AS count
            FROM audit_logs
        `).get().count;

        const violationActions = db.prepare(`
            SELECT COUNT(*) AS count
            FROM audit_logs
            WHERE violation_id IS NOT NULL
        `).get().count;

        const inspectionActions = db.prepare(`
            SELECT COUNT(*) AS count
            FROM audit_logs
            WHERE inspection_id IS NOT NULL
        `).get().count;

        const resolved = db.prepare(`
            SELECT COUNT(*) AS count
            FROM audit_logs
            WHERE action = 'VIOLATION_RESOLVED'
        `).get().count;

        res.json({
            success: true,
            stats: {
                total,
                violation_actions:
                    violationActions,
                inspection_actions:
                    inspectionActions,
                resolved
            }
        });

    } catch (error) {
        console.error(
            "GET /api/audit/stats error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Failed to load audit statistics"
        });
    }
});


/*
=========================================================
GET SINGLE AUDIT RECORD
GET /api/audit/:id
=========================================================
*/

router.get("/:id", (req, res) => {
    try {

        const id = Number(req.params.id);

        if (!Number.isInteger(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid audit ID"
            });
        }

        const log = db.prepare(`
            SELECT *
            FROM audit_logs
            WHERE id = ?
        `).get(id);

        if (!log) {
            return res.status(404).json({
                success: false,
                message:
                    "Audit record not found"
            });
        }

        res.json({
            success: true,
            log
        });

    } catch (error) {
        console.error(
            "GET /api/audit/:id error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Failed to load audit record"
        });
    }
});


module.exports = router;