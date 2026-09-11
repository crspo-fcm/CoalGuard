/*
=========================================================
COALGUARD RISK ENGINE
=========================================================

Provides:

1. Risk score: 0-100
2. Risk level:
   GREEN / MEDIUM / HIGH / CRITICAL
3. Risk factors
4. Recommendation

The detailed analysis is stored in SQLite.

NOTE:
The current engine is rule-based.
We can replace the prediction portion with the
trained ML model later without changing the database
structure.
=========================================================
*/


// =========================================================
// RISK KEYWORDS / RULES
// =========================================================

const riskRules = [

    {
        keywords: ["explosion", "explosive"],
        points: 40,
        factor: "Explosion hazard detected"
    },

    {
        keywords: ["fire", "flames", "burning"],
        points: 35,
        factor: "Fire hazard detected"
    },

    {
        keywords: ["gas leak", "methane", "toxic gas"],
        points: 35,
        factor: "Gas hazard detected"
    },

    {
        keywords: ["collapse", "roof fall", "roof collapse"],
        points: 40,
        factor: "Structural collapse hazard detected"
    },

    {
        keywords: ["flood", "flooding", "waterlogged"],
        points: 30,
        factor: "Flooding hazard detected"
    },

    {
        keywords: ["injury", "accident", "injured"],
        points: 30,
        factor: "Safety incident detected"
    },

    {
        keywords: ["crack", "structural crack"],
        points: 25,
        factor: "Structural damage detected"
    },

    {
        keywords: ["unsafe", "danger", "dangerous"],
        points: 20,
        factor: "Unsafe condition reported"
    },

    {
        keywords: ["ventilation failure", "poor ventilation"],
        points: 25,
        factor: "Ventilation problem detected"
    },

    {
        keywords: ["helmet missing", "no helmet"],
        points: 15,
        factor: "Personal protective equipment issue"
    },

    {
        keywords: [
            "no safety equipment",
            "safety equipment missing"
        ],
        points: 20,
        factor: "Safety equipment deficiency"
    }

];


// =========================================================
// ANALYZE INSPECTION RISK
// =========================================================

function analyzeRisk(observation) {

    // -----------------------------------------------------
    // Empty observation
    // -----------------------------------------------------

    if (
        !observation ||
        observation.trim() === ""
    ) {

        return {

            score: 0,

            level: "GREEN",

            factors: [],

            recommendation:
                "No immediate risk indicators detected."

        };
    }


    // -----------------------------------------------------
    // Normalize text
    // -----------------------------------------------------

    const text =
        observation
            .toLowerCase()
            .trim();


    let score = 0;

    const factors = [];


    // -----------------------------------------------------
    // Check every risk rule
    // -----------------------------------------------------

    for (const rule of riskRules) {

        let detected = false;


        for (const keyword of rule.keywords) {

            if (text.includes(keyword)) {

                detected = true;

                break;
            }
        }


        // -------------------------------------------------
        // Add detected risk
        // -------------------------------------------------

        if (detected) {

            score += rule.points;

            factors.push({

                factor: rule.factor,

                points: rule.points

            });
        }
    }


    // -----------------------------------------------------
    // Cap score at 100
    // -----------------------------------------------------

    if (score > 100) {

        score = 100;
    }


    // -----------------------------------------------------
    // Determine risk level
    // -----------------------------------------------------

    let level;


    if (score >= 75) {

        level = "CRITICAL";

    }

    else if (score >= 50) {

        level = "HIGH";

    }

    else if (score >= 25) {

        level = "MEDIUM";

    }

    else {

        level = "GREEN";
    }


    // -----------------------------------------------------
    // Generate recommendation
    // -----------------------------------------------------

    let recommendation;


    if (level === "CRITICAL") {

        recommendation =
            "Immediate manager intervention and priority inspection recommended.";

    }

    else if (level === "HIGH") {

        recommendation =
            "Urgent corrective action and manager review recommended.";

    }

    else if (level === "MEDIUM") {

        recommendation =
            "Monitor the issue and schedule corrective action.";

    }

    else {

        recommendation =
            "No immediate intervention required. Continue routine monitoring.";
    }


    // -----------------------------------------------------
    // Return complete analysis
    // -----------------------------------------------------

    return {

        score: score,

        level: level,

        factors: factors,

        recommendation: recommendation

    };

}


// =========================================================
// CALCULATE RISK
// =========================================================
//
// Returns the COMPLETE risk analysis.
//
// Example:
//
// {
//     score: 70,
//     level: "HIGH",
//     factors: [...],
//     recommendation: "..."
// }
//
// The inspections route converts HIGH/CRITICAL to RED
// when storing the legacy risk_level field.
// =========================================================

function calculateRisk(observation) {

    return analyzeRisk(observation);

}


// =========================================================
// LEGACY DATABASE RISK LEVEL
// =========================================================
//
// Your existing SQLite CHECK constraint currently accepts:
//
// GREEN
// RED
//
// Therefore this helper converts the four-level engine
// into the two-level legacy database value.
//
// GREEN  -> GREEN
// MEDIUM -> RED
// HIGH   -> RED
// CRITICAL -> RED
// =========================================================

function getDatabaseRiskLevel(level) {

    if (
        level === "HIGH" ||
        level === "CRITICAL" ||
        level === "MEDIUM"
    ) {

        return "RED";
    }

    return "GREEN";
}


// =========================================================
// EXPORT
// =========================================================

module.exports = {

    calculateRisk,

    analyzeRisk,

    getDatabaseRiskLevel

};