const Database = require("better-sqlite3");
const path = require("path");

// =============================================================
// CREATE / CONNECT TO COALGUARD SQLITE DATABASE
// =============================================================

const dbPath = path.join(__dirname, "coalguard.db");

const db = new Database(dbPath);

// Enable foreign key support
db.pragma("foreign_keys = ON");

// =============================================================
// CREATE DATABASE TABLES
// =============================================================

db.exec(`
    /* =========================================================
       USERS
       ========================================================= */

    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL
            CHECK(role IN ('inspector', 'manager', 'admin')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );


    /* =========================================================
       MINE LOCATIONS
       ========================================================= */

    CREATE TABLE IF NOT EXISTS locations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        qr_code TEXT UNIQUE NOT NULL,
        mine_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );


    /* =========================================================
       FIELD INSPECTIONS
       ========================================================= */

    CREATE TABLE IF NOT EXISTS inspections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        inspector_id INTEGER NOT NULL,
        location_id INTEGER NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        distance_meters REAL NOT NULL,
        observation TEXT,
        risk_level TEXT NOT NULL
            CHECK(risk_level IN ('GREEN', 'RED')),
        risk_score INTEGER DEFAULT 0,
        risk_factors TEXT,
        risk_recommendation TEXT,
        status TEXT NOT NULL DEFAULT 'OPEN',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (inspector_id)
            REFERENCES users(id),

        FOREIGN KEY (location_id)
            REFERENCES locations(id)
    );


    /* =========================================================
       GPS / FRAUD ALERTS
       ========================================================= */

    CREATE TABLE IF NOT EXISTS fraud_alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        inspector_id INTEGER,
        location_id INTEGER,
        latitude REAL,
        longitude REAL,
        distance_meters REAL,
        reason TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (inspector_id)
            REFERENCES users(id),

        FOREIGN KEY (location_id)
            REFERENCES locations(id)
    );


    /* =========================================================
       VIOLATIONS MANAGEMENT
       ========================================================= */

    CREATE TABLE IF NOT EXISTS violations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        inspection_id INTEGER,
        title TEXT NOT NULL,
        description TEXT,
        category TEXT NOT NULL,
        severity TEXT NOT NULL,
        reported_by TEXT,
        assigned_to TEXT,
        corrective_action TEXT,
        due_date TEXT,
        status TEXT NOT NULL DEFAULT 'Reported',
        resolution_note TEXT,
        verified_by TEXT,
        verified_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (inspection_id)
            REFERENCES inspections(id)
    );


    /* =========================================================
       AUDIT LOG
       ========================================================= */

    CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        inspection_id INTEGER,
        violation_id INTEGER,
        action TEXT NOT NULL,
        actor TEXT NOT NULL,
        description TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        previous_hash TEXT,
        hash TEXT,

        FOREIGN KEY (inspection_id)
            REFERENCES inspections(id),

        FOREIGN KEY (violation_id)
            REFERENCES violations(id)
    );
`);

// =============================================================
// SAFE DATABASE MIGRATION
// Add mine_id to existing locations table if necessary.
//
// This is important because your coalguard.db already exists.
// CREATE TABLE IF NOT EXISTS does NOT modify an existing table.
// =============================================================

try {
    const locationColumns = db
        .prepare("PRAGMA table_info(locations)")
        .all();

    const hasMineId = locationColumns.some(
        (column) => column.name === "mine_id"
    );

    if (!hasMineId) {
        db.exec(`
            ALTER TABLE locations
            ADD COLUMN mine_id INTEGER
        `);

        console.log(
            "Database migration: locations.mine_id added successfully."
        );
    } else {
        console.log(
            "Database migration: locations.mine_id already exists."
        );
    }
} catch (error) {
    console.error(
        "Database migration error:",
        error
    );
}


// =============================================================
// DEMO USER
// =============================================================

const demoUser = db
    .prepare(
        "SELECT id FROM users WHERE email = ?"
    )
    .get("inspector@coalguard.local");

if (!demoUser) {
    db.prepare(`
        INSERT INTO users
        (name, email, password, role)
        VALUES (?, ?, ?, ?)
    `).run(
        "Field Inspector",
        "inspector@coalguard.local",
        "demo-password",
        "inspector"
    );
}


// =============================================================
// DEMO MINE LOCATIONS
// =============================================================

const demoLocations = [
    [
        "Central Coal Mine",
        "Primary demonstration mine",
        23.6102,
        85.2799,
        "COALGUARD-MINE-001"
    ],

    [
        "North Valley Mine",
        "North demonstration mine",
        23.3441,
        85.3096,
        "COALGUARD-MINE-002"
    ],

    [
        "East Ridge Mine",
        "East demonstration mine",
        23.6739,
        87.6747,
        "COALGUARD-MINE-003"
    ],

    [
        "South Block Mine",
        "South demonstration mine",
        20.9517,
        85.0985,
        "COALGUARD-MINE-004"
    ],

    [
        "Western Open Cast Mine",
        "Western demonstration mine",
        21.2787,
        81.8661,
        "COALGUARD-MINE-005"
    ]
];


const insertLocation = db.prepare(`
    INSERT OR IGNORE INTO locations
    (
        name,
        description,
        latitude,
        longitude,
        qr_code
    )
    VALUES (?, ?, ?, ?, ?)
`);


for (const location of demoLocations) {
    insertLocation.run(...location);
}


// =============================================================
// DATABASE READY
// =============================================================

console.log(
    "CoalGuard database initialized successfully."
);

module.exports = db;