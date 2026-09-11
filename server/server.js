const express = require("express");
const cors = require("cors");
const path = require("path");
const violationsRoutes = require("./routes/violations");
const db = require("./database/database");
const { verifyLocation } = require("./services/gps");
const { calculateRisk } = require("./services/riskDetection");
const locationRoutes = require("./routes/locations");
const inspectionRoutes = require("./routes/inspections");
const authRoutes = require("./routes/auth");
const auditRoutes = require("./routes/audit.js");
const app = express();
const PORT = process.env.PORT || 3000;
const mineRoutes = require("./routes/mine");
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use("/api/violations", violationsRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/mines", mineRoutes);
app.use("/api/inspections", inspectionRoutes);
app.use("/api/locations", locationRoutes);
app.use("/api/audit", auditRoutes);
app.get("/", (req, res) => {
    res.json({
        application: "CoalGuard",
        status: "online",
        message: "CoalGuard backend is running successfully."
    });
});

app.get("/api/health", (req, res) => {
    res.json({ success: true, application: "CoalGuard", status: "online" });
});

app.get("/api/test", (req, res) => {
    try {
        const result = db.prepare("SELECT 1 AS connected").get();
        res.json({
            success: true,
            message: "Database connected successfully.",
            database: result.connected === 1
        });
    } catch (error) {
        console.error("Database error:", error);
        res.status(500).json({ success: false, message: "Database connection failed." });
    }
});

app.get("/api/gps-test", (req, res) => {
    const mineLatitude = 22.5726;
    const mineLongitude = 88.3639;
    const inspectorLatitude = 22.5727;
    const inspectorLongitude = 88.3640;
    const result = verifyLocation(
        inspectorLatitude,
        inspectorLongitude,
        mineLatitude,
        mineLongitude
    );
    res.json({
        success: true,
        inspectorLocation: { latitude: inspectorLatitude, longitude: inspectorLongitude },
        registeredLocation: { latitude: mineLatitude, longitude: mineLongitude },
        verification: result
    });
});

app.post("/api/risk-test", (req, res) => {
    const { observation } = req.body;
    res.json({
        success: true,
        observation,
        riskLevel: calculateRisk(observation)
    });
});

// In production Express serves the built React app from /dist.
const distPath = path.join(__dirname, "..", "dist");
app.use(express.static(distPath));
app.use((req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(distPath, "index.html"), (error) => {
        if (error) next();
    });
});

app.listen(PORT, () => {
    console.log("----------------------------------------");
    console.log("        COALGUARD BACKEND");
    console.log("----------------------------------------");
    console.log(`Server running on: http://localhost:${PORT}`);
    console.log("Database: Connected");
    console.log("Status: ONLINE");
    console.log("----------------------------------------");
});
