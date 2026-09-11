const express = require("express");

const router = express.Router();

const db = require("../database/database");

// Get all registered mine locations
router.get("/", (req, res) => {
    try {
        const locations = db.prepare(`
            SELECT
                id,
                name,
                description,
                latitude,
                longitude,
                qr_code,
                created_at
            FROM locations
            ORDER BY id DESC
        `).all();

        res.json({
            success: true,
            count: locations.length,
            locations: locations
        });

    } catch (error) {
        console.error("Location error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch mine locations."
        });
    }
});


// Get one mine location by ID
router.get("/:id", (req, res) => {
    try {
        const location = db.prepare(`
            SELECT
                id,
                name,
                description,
                latitude,
                longitude,
                qr_code,
                created_at
            FROM locations
            WHERE id = ?
        `).get(req.params.id);

        if (!location) {
            return res.status(404).json({
                success: false,
                message: "Mine location not found."
            });
        }

        res.json({
            success: true,
            location: location
        });

    } catch (error) {
        console.error("Location error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch mine location."
        });
    }
});


module.exports = router;