const express = require("express");
const router = express.Router();

const db = require("../database/database");

/*
  COALGUARD — MINE MASTER DATA

  This is a governance/demo catalogue of major established
  Indian coal-mining operations.

  Compliance values are DEMO values for dashboard visualization.
  Coordinates are approximate and intended for map visualization,
  not survey-grade mine boundaries.
*/

// ============================================================
// CREATE MINES TABLE
// ============================================================

db.exec(`
  CREATE TABLE IF NOT EXISTS mines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    company TEXT NOT NULL,
    subsidiary TEXT,
    state TEXT NOT NULL,
    coalfield TEXT,
    mine_type TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'Operational',
    compliance REAL NOT NULL DEFAULT 85,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

// ============================================================
// MAJOR INDIAN COAL MINES
// ============================================================

const MINE_CATALOGUE = [

  // ==========================================================
  // SECL — SOUTH EASTERN COALFIELDS LIMITED
  // ==========================================================

  {
    name: "Gevra Opencast Mine",
    company: "Coal India Limited",
    subsidiary: "SECL",
    state: "Chhattisgarh",
    coalfield: "Korba Coalfield",
    mine_type: "Opencast",
    latitude: 22.345,
    longitude: 82.650,
    status: "Operational",
    compliance: 88
  },

  {
    name: "Kusmunda Opencast Mine",
    company: "Coal India Limited",
    subsidiary: "SECL",
    state: "Chhattisgarh",
    coalfield: "Korba Coalfield",
    mine_type: "Opencast",
    latitude: 22.337,
    longitude: 82.695,
    status: "Operational",
    compliance: 91
  },

  {
    name: "Dipka Opencast Mine",
    company: "Coal India Limited",
    subsidiary: "SECL",
    state: "Chhattisgarh",
    coalfield: "Korba Coalfield",
    mine_type: "Opencast",
    latitude: 22.361,
    longitude: 82.590,
    status: "Operational",
    compliance: 86
  },

  {
    name: "Chhal Opencast Mine",
    company: "Coal India Limited",
    subsidiary: "SECL",
    state: "Chhattisgarh",
    coalfield: "Mand-Raigarh Coalfield",
    mine_type: "Opencast",
    latitude: 22.075,
    longitude: 83.295,
    status: "Operational",
    compliance: 93
  },

  {
    name: "Bishrampur Colliery",
    company: "Coal India Limited",
    subsidiary: "SECL",
    state: "Chhattisgarh",
    coalfield: "Bishrampur Coalfield",
    mine_type: "Mixed",
    latitude: 23.185,
    longitude: 83.180,
    status: "Operational",
    compliance: 89
  },

  // ==========================================================
  // MCL — MAHANADI COALFIELDS LIMITED
  // ==========================================================

  {
    name: "Bhubaneswari Opencast Mine",
    company: "Coal India Limited",
    subsidiary: "MCL",
    state: "Odisha",
    coalfield: "Talcher Coalfield",
    mine_type: "Opencast",
    latitude: 20.930,
    longitude: 85.110,
    status: "Operational",
    compliance: 90
  },

  {
    name: "Lingaraj Opencast Mine",
    company: "Coal India Limited",
    subsidiary: "MCL",
    state: "Odisha",
    coalfield: "Talcher Coalfield",
    mine_type: "Opencast",
    latitude: 20.950,
    longitude: 85.070,
    status: "Operational",
    compliance: 94
  },

  {
    name: "Ananta Opencast Mine",
    company: "Coal India Limited",
    subsidiary: "MCL",
    state: "Odisha",
    coalfield: "Talcher Coalfield",
    mine_type: "Opencast",
    latitude: 20.970,
    longitude: 85.120,
    status: "Operational",
    compliance: 87
  },

  {
    name: "Kaniha Opencast Mine",
    company: "Coal India Limited",
    subsidiary: "MCL",
    state: "Odisha",
    coalfield: "Talcher Coalfield",
    mine_type: "Opencast",
    latitude: 20.980,
    longitude: 85.160,
    status: "Operational",
    compliance: 92
  },

  {
    name: "Bharatpur Opencast Mine",
    company: "Coal India Limited",
    subsidiary: "MCL",
    state: "Odisha",
    coalfield: "Talcher Coalfield",
    mine_type: "Opencast",
    latitude: 20.920,
    longitude: 85.060,
    status: "Operational",
    compliance: 85
  },

  // ==========================================================
  // NCL — NORTHERN COALFIELDS LIMITED
  // ==========================================================

  {
    name: "Gorbi Mine",
    company: "Coal India Limited",
    subsidiary: "NCL",
    state: "Madhya Pradesh",
    coalfield: "Singrauli Coalfield",
    mine_type: "Opencast",
    latitude: 24.170,
    longitude: 82.670,
    status: "Operational",
    compliance: 90
  },

  {
    name: "Jayant Opencast Mine",
    company: "Coal India Limited",
    subsidiary: "NCL",
    state: "Madhya Pradesh",
    coalfield: "Singrauli Coalfield",
    mine_type: "Opencast",
    latitude: 24.150,
    longitude: 82.660,
    status: "Operational",
    compliance: 88
  },

  {
    name: "Nigahi Opencast Mine",
    company: "Coal India Limited",
    subsidiary: "NCL",
    state: "Madhya Pradesh",
    coalfield: "Singrauli Coalfield",
    mine_type: "Opencast",
    latitude: 24.120,
    longitude: 82.690,
    status: "Operational",
    compliance: 84
  },

  {
    name: "Dudhichua Opencast Mine",
    company: "Coal India Limited",
    subsidiary: "NCL",
    state: "Uttar Pradesh",
    coalfield: "Singrauli Coalfield",
    mine_type: "Opencast",
    latitude: 24.100,
    longitude: 82.680,
    status: "Operational",
    compliance: 86
  },

  {
    name: "Khadia Opencast Mine",
    company: "Coal India Limited",
    subsidiary: "NCL",
    state: "Uttar Pradesh",
    coalfield: "Singrauli Coalfield",
    mine_type: "Opencast",
    latitude: 24.070,
    longitude: 82.720,
    status: "Operational",
    compliance: 91
  },

  // ==========================================================
  // CCL — CENTRAL COALFIELDS LIMITED
  // ==========================================================

  {
    name: "Ashoka Opencast Project",
    company: "Coal India Limited",
    subsidiary: "CCL",
    state: "Jharkhand",
    coalfield: "North Karanpura Coalfield",
    mine_type: "Opencast",
    latitude: 23.720,
    longitude: 84.980,
    status: "Operational",
    compliance: 89
  },

  {
    name: "Piparwar Opencast Project",
    company: "Coal India Limited",
    subsidiary: "CCL",
    state: "Jharkhand",
    coalfield: "North Karanpura Coalfield",
    mine_type: "Opencast",
    latitude: 23.700,
    longitude: 84.960,
    status: "Operational",
    compliance: 87
  },

  {
    name: "Magadh Amrapali Area",
    company: "Coal India Limited",
    subsidiary: "CCL",
    state: "Jharkhand",
    coalfield: "North Karanpura Coalfield",
    mine_type: "Opencast",
    latitude: 23.720,
    longitude: 84.820,
    status: "Operational",
    compliance: 83
  },

  // ==========================================================
  // BCCL — BHARAT COKING COAL LIMITED
  // ==========================================================

  {
    name: "Moonidih Colliery",
    company: "Coal India Limited",
    subsidiary: "BCCL",
    state: "Jharkhand",
    coalfield: "Jharia Coalfield",
    mine_type: "Underground",
    latitude: 23.720,
    longitude: 86.270,
    status: "Operational",
    compliance: 82
  },

  {
    name: "Sudamdih Colliery",
    company: "Coal India Limited",
    subsidiary: "BCCL",
    state: "Jharkhand",
    coalfield: "Jharia Coalfield",
    mine_type: "Underground",
    latitude: 23.670,
    longitude: 86.380,
    status: "Operational",
    compliance: 84
  },

  {
    name: "Lodna Area",
    company: "Coal India Limited",
    subsidiary: "BCCL",
    state: "Jharkhand",
    coalfield: "Jharia Coalfield",
    mine_type: "Mixed",
    latitude: 23.710,
    longitude: 86.430,
    status: "Operational",
    compliance: 81
  },

  // ==========================================================
  // ECL — EASTERN COALFIELDS LIMITED
  // ==========================================================

  {
    name: "Rajmahal Opencast Project",
    company: "Coal India Limited",
    subsidiary: "ECL",
    state: "Jharkhand",
    coalfield: "Rajmahal Coalfield",
    mine_type: "Opencast",
    latitude: 25.020,
    longitude: 87.420,
    status: "Operational",
    compliance: 86
  },

  {
    name: "Mugma Area",
    company: "Coal India Limited",
    subsidiary: "ECL",
    state: "Jharkhand",
    coalfield: "Raniganj Coalfield",
    mine_type: "Mixed",
    latitude: 23.780,
    longitude: 86.770,
    status: "Operational",
    compliance: 88
  },

  {
    name: "Sonepur Bazari Opencast Project",
    company: "Coal India Limited",
    subsidiary: "ECL",
    state: "West Bengal",
    coalfield: "Raniganj Coalfield",
    mine_type: "Opencast",
    latitude: 23.650,
    longitude: 87.120,
    status: "Operational",
    compliance: 90
  },

  // ==========================================================
  // WCL — WESTERN COALFIELDS LIMITED
  // ==========================================================

  {
    name: "Umrer Opencast Mine",
    company: "Coal India Limited",
    subsidiary: "WCL",
    state: "Maharashtra",
    coalfield: "Nagpur Coalfield",
    mine_type: "Opencast",
    latitude: 20.850,
    longitude: 79.330,
    status: "Operational",
    compliance: 92
  },

  {
    name: "Penganga Opencast Mine",
    company: "Coal India Limited",
    subsidiary: "WCL",
    state: "Maharashtra",
    coalfield: "Wardha Valley Coalfield",
    mine_type: "Opencast",
    latitude: 20.120,
    longitude: 78.930,
    status: "Operational",
    compliance: 89
  },

  {
    name: "Wani Area",
    company: "Coal India Limited",
    subsidiary: "WCL",
    state: "Maharashtra",
    coalfield: "Wardha Valley Coalfield",
    mine_type: "Mixed",
    latitude: 20.050,
    longitude: 78.950,
    status: "Operational",
    compliance: 85
  },

  // ==========================================================
  // REPRESENTATIVE COALFIELD CLUSTERS
  // ==========================================================

  {
    name: "Singrauli Coalfield Cluster",
    company: "Coal India Limited",
    subsidiary: "NCL",
    state: "Madhya Pradesh",
    coalfield: "Singrauli Coalfield",
    mine_type: "Opencast Cluster",
    latitude: 24.110,
    longitude: 82.650,
    status: "Operational",
    compliance: 88
  },

  {
    name: "Talcher Coalfield Cluster",
    company: "Coal India Limited",
    subsidiary: "MCL",
    state: "Odisha",
    coalfield: "Talcher Coalfield",
    mine_type: "Opencast Cluster",
    latitude: 20.950,
    longitude: 85.100,
    status: "Operational",
    compliance: 90
  }

];

// ============================================================
// SEED MINES
// ============================================================

const insertMine = db.prepare(`
  INSERT OR IGNORE INTO mines (
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
  )
  VALUES (
    @name,
    @company,
    @subsidiary,
    @state,
    @coalfield,
    @mine_type,
    @latitude,
    @longitude,
    @status,
    @compliance
  )
`);

const seedMines = db.transaction(() => {
  for (const mine of MINE_CATALOGUE) {
    insertMine.run(mine);
  }
});

seedMines();

// ============================================================
// LINK INSPECTION LOCATIONS TO EXACT REGISTERED MINES
// ============================================================
//
// Existing inspections continue using location_id.
//
// locations.mine_id now tells CoalGuard exactly which of the
// 29 registered mines that inspection location represents.
//
// Location 1 → Mine 1  Gevra
// Location 2 → Mine 2  Kusmunda
// Location 3 → Mine 3  Dipka
// Location 4 → Mine 6  Bhubaneswari
// Location 5 → Mine 16 Ashoka
// Location 6 → Mine 24 Sonepur Bazari
// ============================================================

try {

  const mineLinks = [
    [1, 1],
    [2, 2],
    [3, 3],
    [4, 6],
    [5, 16],
    [6, 24]
  ];

  const updateLocationMine = db.prepare(`
    UPDATE locations
    SET mine_id = ?
    WHERE id = ?
  `);

  const linkLocations = db.transaction(() => {

    for (const [locationId, mineId] of mineLinks) {

      const mineExists = db
        .prepare(`
          SELECT id
          FROM mines
          WHERE id = ?
        `)
        .get(mineId);

      if (!mineExists) {
        console.warn(
          `Mine ${mineId} does not exist. Skipping location ${locationId}.`
        );

        continue;
      }

      updateLocationMine.run(
        mineId,
        locationId
      );
    }

  });

  linkLocations();

  console.log(
    "CoalGuard: inspection locations linked to registered mines."
  );

} catch (error) {

  console.error(
    "Mine-location linking error:",
    error
  );

}

// ============================================================
// GET MINE SUMMARY
// ============================================================
//
// IMPORTANT:
// This route comes BEFORE /:id so that
// /api/mines/summary/overview works correctly.
// ============================================================

router.get("/summary/overview", (req, res) => {

  try {

    const summary = db.prepare(`
      SELECT
        COUNT(*) AS total_mines,

        SUM(
          CASE
            WHEN status = 'Operational'
            THEN 1
            ELSE 0
          END
        ) AS operational_mines,

        ROUND(
          AVG(compliance),
          1
        ) AS average_compliance,

        COUNT(
          DISTINCT state
        ) AS states_covered,

        COUNT(
          DISTINCT subsidiary
        ) AS subsidiaries_covered

      FROM mines
    `).get();

    res.json({
      success: true,
      summary
    });

  } catch (error) {

    console.error(
      "Mine summary error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Failed to load mine summary."
    });

  }

});

// ============================================================
// GET ALL MINES
// ============================================================

router.get("/", (req, res) => {

  try {

    const mines = db.prepare(`
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
        compliance,
        created_at
      FROM mines
      ORDER BY state ASC, name ASC
    `).all();

    res.json({
      success: true,
      count: mines.length,
      mines
    });

  } catch (error) {

    console.error(
      "GET /api/mines error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Failed to load mine registry."
    });

  }

});

// ============================================================
// GET ONE MINE
// ============================================================

router.get("/:id", (req, res) => {

  try {

    const mine = db.prepare(`
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
        compliance,
        created_at
      FROM mines
      WHERE id = ?
    `).get(Number(req.params.id));

    if (!mine) {

      return res.status(404).json({
        success: false,
        message: "Mine not found."
      });

    }

    res.json({
      success: true,
      mine
    });

  } catch (error) {

    console.error(
      "GET /api/mines/:id error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Failed to load mine."
    });

  }

});

// ============================================================
// EXPORT ROUTER
// ============================================================

module.exports = router;