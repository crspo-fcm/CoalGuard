const express = require("express");
const crypto = require("crypto");
const db = require("../database/database");

const router = express.Router();

/* =========================================================
   AUDIT LOG HELPER
   ========================================================= */

function createAuditLog(
    inspectionId,
    violationId,
    action,
    actor,
    auditDescription
) {
    try {
        const previous = db.prepare(`
            SELECT hash
            FROM audit_logs
            ORDER BY id DESC
            LIMIT 1
        `).get();

        const previousHash =
            previous && previous.hash
                ? previous.hash
                : "GENESIS";

        const timestamp = new Date().toISOString();

        const hashInput =
            `${previousHash}|${inspectionId || ""}|${violationId || ""}|${action}|${actor}|${auditDescription}|${timestamp}`;

        const hash = crypto
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
            inspectionId || null,
            violationId || null,
            action,
            actor || "System",
            auditDescription || "",
            timestamp,
            previousHash,
            hash
        );

    } catch (error) {
        console.error("Error creating audit log:", error);
    }
}


/* =========================================================
   GET ALL VIOLATIONS
   GET /api/violations
   ========================================================= */

router.get("/", (req, res) => {
    try {
        const violations = db.prepare(`
            SELECT
                v.*,
                i.observation AS inspection_observation,
                u.name AS inspector_name,
                l.name AS location_name
            FROM violations v

            LEFT JOIN inspections i
                ON v.inspection_id = i.id

            LEFT JOIN users u
                ON i.inspector_id = u.id

            LEFT JOIN locations l
                ON i.location_id = l.id

            ORDER BY v.created_at DESC
        `).all();

        res.json({
            success: true,
            violations
        });

    } catch (error) {
        console.error("Error fetching violations:", error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch violations"
        });
    }
});


/* =========================================================
   GET SINGLE VIOLATION
   GET /api/violations/:id
   ========================================================= */

router.get("/:id", (req, res) => {
    try {
        const id = Number(req.params.id);

        const violation = db.prepare(`
            SELECT
                v.*,
                i.observation AS inspection_observation,
                u.name AS inspector_name,
                l.name AS location_name
            FROM violations v

            LEFT JOIN inspections i
                ON v.inspection_id = i.id

            LEFT JOIN users u
                ON i.inspector_id = u.id

            LEFT JOIN locations l
                ON i.location_id = l.id

            WHERE v.id = ?
        `).get(id);

        if (!violation) {
            return res.status(404).json({
                success: false,
                message: "Violation not found"
            });
        }

        res.json({
            success: true,
            violation
        });

    } catch (error) {
        console.error("Error fetching violation:", error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch violation"
        });
    }
});


/* =========================================================
   CREATE VIOLATION
   POST /api/violations
   ========================================================= */

router.post("/", (req, res) => {
    try {
        const {
            inspection_id,
            title,
            description,
            category,
            severity,
            reported_by,
            assigned_to,
            corrective_action,
            due_date
        } = req.body;

        if (!title || !category || !severity) {
            return res.status(400).json({
                success: false,
                message: "Title, category and severity are required"
            });
        }

        /* Validate inspection if supplied */

        if (
            inspection_id !== undefined &&
            inspection_id !== null &&
            inspection_id !== ""
        ) {
            const inspection = db.prepare(`
                SELECT id
                FROM inspections
                WHERE id = ?
            `).get(Number(inspection_id));

            if (!inspection) {
                return res.status(400).json({
                    success: false,
                    message: "Inspection not found"
                });
            }
        }

        /* Insert violation */

        const result = db.prepare(`
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
            inspection_id
                ? Number(inspection_id)
                : null,

            title,
            description || "",
            category,
            severity,
            reported_by || "",
            assigned_to || "",
            corrective_action || "",
            due_date || "",
            "Reported"
        );

        const violationId = Number(result.lastInsertRowid);

        /* Create audit record */

        createAuditLog(
            inspection_id
                ? Number(inspection_id)
                : null,

            violationId,

            "VIOLATION_REPORTED",

            reported_by || "System",

            `Violation "${title}" was reported.`
        );

        /* Get created violation */

        const violation = db.prepare(`
            SELECT *
            FROM violations
            WHERE id = ?
        `).get(violationId);

        res.status(201).json({
            success: true,
            message: "Violation created successfully",
            violation
        });

    } catch (error) {
        console.error("Error creating violation:", error);

        res.status(500).json({
            success: false,
            message: "Failed to create violation"
        });
    }
});


/* =========================================================
   UPDATE VIOLATION
   PATCH /api/violations/:id
   ========================================================= */

router.patch("/:id", (req, res) => {
    try {
        const id = Number(req.params.id);

        const existing = db.prepare(`
            SELECT *
            FROM violations
            WHERE id = ?
        `).get(id);

        if (!existing) {
            return res.status(404).json({
                success: false,
                message: "Violation not found"
            });
        }

        const {
            title,
            description,
            category,
            severity,
            reported_by,
            assigned_to,
            corrective_action,
            due_date,
            status,
            resolution_note,
            verified_by,
            verified_at
        } = req.body;

        const newTitle =
            title !== undefined
                ? title
                : existing.title;

        const newDescription =
            description !== undefined
                ? description
                : existing.description;

        const newCategory =
            category !== undefined
                ? category
                : existing.category;

        const newSeverity =
            severity !== undefined
                ? severity
                : existing.severity;

        const newReportedBy =
            reported_by !== undefined
                ? reported_by
                : existing.reported_by;

        const newAssignedTo =
            assigned_to !== undefined
                ? assigned_to
                : existing.assigned_to;

        const newCorrectiveAction =
            corrective_action !== undefined
                ? corrective_action
                : existing.corrective_action;

        const newDueDate =
            due_date !== undefined
                ? due_date
                : existing.due_date;

        const newStatus =
            status !== undefined
                ? status
                : existing.status;

        const newResolutionNote =
            resolution_note !== undefined
                ? resolution_note
                : existing.resolution_note;

        const newVerifiedBy =
            verified_by !== undefined
                ? verified_by
                : existing.verified_by;

        const newVerifiedAt =
            verified_at !== undefined
                ? verified_at
                : existing.verified_at;


        /* Update database */

        db.prepare(`
            UPDATE violations
            SET
                title = ?,
                description = ?,
                category = ?,
                severity = ?,
                reported_by = ?,
                assigned_to = ?,
                corrective_action = ?,
                due_date = ?,
                status = ?,
                resolution_note = ?,
                verified_by = ?,
                verified_at = ?
            WHERE id = ?
        `).run(
            newTitle,
            newDescription,
            newCategory,
            newSeverity,
            newReportedBy,
            newAssignedTo,
            newCorrectiveAction,
            newDueDate,
            newStatus,
            newResolutionNote,
            newVerifiedBy,
            newVerifiedAt,
            id
        );


        /* Determine audit action */

        let auditAction = "VIOLATION_UPDATED";

        let auditDescription =
            `Violation #${id} was updated.`;

        let auditActor =
            newVerifiedBy ||
            newAssignedTo ||
            newReportedBy ||
            "System";


        if (
            status !== undefined &&
            status !== existing.status
        ) {
            auditAction = "STATUS_CHANGED";

            auditDescription =
                `Violation #${id} status changed from "${existing.status}" to "${status}".`;
        }


        if (
            assigned_to !== undefined &&
            assigned_to !== existing.assigned_to
        ) {
            auditAction =
                "CORRECTIVE_ACTION_ASSIGNED";

            auditDescription =
                `Violation #${id} was assigned to "${assigned_to}".`;
        }


        if (status === "In Progress") {
            auditAction =
                "CORRECTIVE_ACTION_STARTED";

            auditDescription =
                `Corrective action started for violation #${id}.`;
        }


        if (status === "Awaiting Verification") {
            auditAction =
                "VERIFICATION_REQUESTED";

            auditDescription =
                `Verification requested for violation #${id}.`;
        }


        if (status === "Resolved") {
            auditAction =
                "VIOLATION_RESOLVED";

            auditDescription =
                `Violation #${id} was verified and resolved.`;
        }


        /* Create audit record */

        createAuditLog(
            null,
            id,
            auditAction,
            auditActor,
            auditDescription
        );


        /* Return updated violation */

        const updatedViolation = db.prepare(`
            SELECT *
            FROM violations
            WHERE id = ?
        `).get(id);

        res.json({
            success: true,
            message: "Violation updated successfully",
            violation: updatedViolation
        });

    } catch (error) {
        console.error("Error updating violation:", error);

        res.status(500).json({
            success: false,
            message: "Failed to update violation"
        });
    }
});


/* =========================================================
   DELETE VIOLATION
   DELETE /api/violations/:id
   ========================================================= */

router.delete("/:id", (req, res) => {
    try {
        const id = Number(req.params.id);

        const violation = db.prepare(`
            SELECT *
            FROM violations
            WHERE id = ?
        `).get(id);

        if (!violation) {
            return res.status(404).json({
                success: false,
                message: "Violation not found"
            });
        }


        /* Delete related audit records first */

        db.prepare(`
            DELETE FROM audit_logs
            WHERE violation_id = ?
        `).run(id);


        /* Delete violation */

        db.prepare(`
            DELETE FROM violations
            WHERE id = ?
        `).run(id);


        res.json({
            success: true,
            message: "Violation deleted successfully"
        });

    } catch (error) {
        console.error("Error deleting violation:", error);

        res.status(500).json({
            success: false,
            message: "Failed to delete violation"
        });
    }
});


module.exports = router;