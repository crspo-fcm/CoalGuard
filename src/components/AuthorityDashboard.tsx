import { useEffect, useMemo, useState } from "react";
import AuditLedger from "./AuditLedger";
import ComplianceReports from "./ComplianceReports";
import MineMap from "./MineMap";

/* =========================================================
   TYPES
========================================================= */

type Inspection = {
  id: number;
  inspector_name?: string | null;
  location_name?: string | null;
  observation?: string | null;
  risk_level?: string | null;
  risk_score?: number | null;
  distance_meters?: number | null;
  created_at?: string | null;
};

type Violation = {
  id: number;
  inspection_id?: number | null;
  title: string;
  description?: string | null;
  category: string;
  severity: string;
  reported_by?: string | null;
  assigned_to?: string | null;
  corrective_action?: string | null;
  due_date?: string | null;
  status: string;
  created_at: string;
  location_name?: string | null;
  inspector_name?: string | null;
};

type FraudAlert = {
  id: number;
  latitude: number;
  longitude: number;
  distance_meters: number;
  reason: string;
  created_at: string;
  inspector_name?: string | null;
  location_name?: string | null;
};

type Mine = {
  id: number;
  name?: string;
  location_name?: string;
  latitude?: number;
  longitude?: number;
  status?: string;
  compliance?: number;
  company?: string;
  subsidiary?: string;
  coalfield?: string;
  mine_type?: string;
};

type MineGovernance = {
  mine: Mine;
  inspections: Inspection[];
  violations: Violation[];
  openViolations: Violation[];
  criticalHigh: number;
  compliance: number;
  risk: string;
  latestRiskScore: number;
  governance: string;
};

/* =========================================================
   HELPERS
========================================================= */

function normalize(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .trim();
}

function severityValue(value: unknown): number {
  const severity = normalize(value);

  if (severity === "critical") return 4;
  if (severity === "high") return 3;
  if (severity === "medium") return 2;
  if (severity === "low") return 1;

  return 0;
}

function isResolved(status: unknown): boolean {
  return normalize(status) === "resolved";
}

function riskLabel(
  score: number,
  riskLevel?: string | null
): string {
  if (score >= 85) return "CRITICAL";
  if (score >= 70) return "HIGH";
  if (score >= 40) return "MEDIUM";

  if (normalize(riskLevel) === "red") {
    return "HIGH";
  }

  return "GREEN";
}

function riskClass(level: string): string {
  if (level === "CRITICAL") {
    return "cg-status-critical";
  }

  if (level === "HIGH") {
    return "cg-status-high";
  }

  if (level === "MEDIUM") {
    return "cg-status-moderate";
  }

  return "cg-status-low";
}

function governanceClass(status: string): string {
  if (status === "ESCALATED") {
    return "cg-status-critical";
  }

  if (status === "ATTENTION") {
    return "cg-status-high";
  }

  if (status === "WATCH") {
    return "cg-status-moderate";
  }

  return "cg-status-low";
}

function getMineName(mine: Mine): string {
  return (
    mine.name ||
    mine.location_name ||
    `Mine #${mine.id}`
  );
}

function getInspectionMineName(
  inspection: Inspection
): string {
  return normalize(inspection.location_name);
}

function getViolationMineName(
  violation: Violation
): string {
  return normalize(violation.location_name);
}

/* =========================================================
   MINE COMPLIANCE
========================================================= */

function calculateMineCompliance(
  openViolations: Violation[]
): number {
  if (openViolations.length === 0) {
    return 100;
  }

  const penalty = openViolations.reduce(
    (total, violation) => {
      const severity = severityValue(
        violation.severity
      );

      if (severity === 4) {
        return total + 30;
      }

      if (severity === 3) {
        return total + 20;
      }

      if (severity === 2) {
        return total + 10;
      }

      return total + 5;
    },
    0
  );

  return Math.max(
    0,
    Math.round(100 - penalty)
  );
}

/* =========================================================
   MINE RISK
========================================================= */

function calculateMineRisk(
  mineInspections: Inspection[],
  mineOpenViolations: Violation[]
): {
  level: string;
  score: number;
} {
  const critical =
    mineOpenViolations.filter(
      violation =>
        severityValue(violation.severity) === 4
    ).length;

  const high =
    mineOpenViolations.filter(
      violation =>
        severityValue(violation.severity) === 3
    ).length;

  const medium =
    mineOpenViolations.filter(
      violation =>
        severityValue(violation.severity) === 2
    ).length;

  const inspectionScores =
    mineInspections
      .map(inspection =>
        Number(inspection.risk_score || 0)
      )
      .filter(
        score => !Number.isNaN(score)
      );

  const highestInspectionScore =
    inspectionScores.length > 0
      ? Math.max(...inspectionScores)
      : 0;

  if (critical > 0) {
    return {
      level: "CRITICAL",
      score: Math.max(
        85,
        highestInspectionScore
      ),
    };
  }

  if (
    high > 0 ||
    highestInspectionScore >= 70
  ) {
    return {
      level: "HIGH",
      score: Math.max(
        70,
        highestInspectionScore
      ),
    };
  }

  if (
    medium > 0 ||
    highestInspectionScore >= 40
  ) {
    return {
      level: "MEDIUM",
      score: Math.max(
        40,
        highestInspectionScore
      ),
    };
  }

  return {
    level: "GREEN",
    score: highestInspectionScore,
  };
}

/* =========================================================
   GOVERNANCE STATUS
========================================================= */

function calculateGovernanceStatus(
  compliance: number,
  risk: string,
  criticalHigh: number
): string {
  if (
    risk === "CRITICAL" ||
    criticalHigh > 0
  ) {
    return "ESCALATED";
  }

  if (
    risk === "HIGH" ||
    compliance < 75
  ) {
    return "ATTENTION";
  }

  if (
    risk === "MEDIUM" ||
    compliance < 90
  ) {
    return "WATCH";
  }

  return "COMPLIANT";
}

/* =========================================================
   AUTHORITY DASHBOARD
========================================================= */

function AuthorityDashboard() {
  const [inspections, setInspections] =
    useState<Inspection[]>([]);

  const [violations, setViolations] =
    useState<Violation[]>([]);

  const [fraudAlerts, setFraudAlerts] =
    useState<FraudAlert[]>([]);

  const [mines, setMines] =
    useState<Mine[]>([]);

  const [backendError, setBackendError] =
    useState("");

  const [lastUpdated, setLastUpdated] =
    useState("");

  /* =======================================================
     LOAD LIVE DATA
  ======================================================= */

  const loadData = async () => {
    try {
      const [
        inspectionResponse,
        violationResponse,
        fraudResponse,
        mineResponse,
      ] = await Promise.all([
        fetch("/api/inspections"),
        fetch("/api/violations"),
        fetch("/api/inspections/fraud-alerts"),
        fetch("/api/mines"),
      ]);

      const inspectionData =
        await inspectionResponse
          .json()
          .catch(() => ({}));

      const violationData =
        await violationResponse
          .json()
          .catch(() => ({}));

      const fraudData =
        await fraudResponse
          .json()
          .catch(() => ({}));

      const mineData =
        await mineResponse
          .json()
          .catch(() => ({}));

      if (!inspectionResponse.ok) {
        throw new Error(
          inspectionData.message ||
            "Failed to load inspections."
        );
      }

      if (!violationResponse.ok) {
        throw new Error(
          violationData.message ||
            "Failed to load violations."
        );
      }

      if (!fraudResponse.ok) {
        throw new Error(
          fraudData.message ||
            "Failed to load fraud alerts."
        );
      }

      if (!mineResponse.ok) {
        throw new Error(
          mineData.message ||
            "Failed to load mines."
        );
      }

      setInspections(
        Array.isArray(
          inspectionData.inspections
        )
          ? inspectionData.inspections
          : []
      );

      setViolations(
        Array.isArray(
          violationData.violations
        )
          ? violationData.violations
          : []
      );

      setFraudAlerts(
        Array.isArray(fraudData.alerts)
          ? fraudData.alerts
          : []
      );

      setMines(
        Array.isArray(mineData.mines)
          ? mineData.mines
          : []
      );

      setBackendError("");

      setLastUpdated(
        new Date().toLocaleTimeString(
          "en-IN"
        )
      );
    } catch (error) {
      console.error(
        "Authority dashboard error:",
        error
      );

      setBackendError(
        error instanceof Error
          ? error.message
          : "Backend connection failed."
      );
    }
  };

  /* =======================================================
     AUTO REFRESH
  ======================================================= */

  useEffect(() => {
    void loadData();

    const timer =
      window.setInterval(() => {
        void loadData();
      }, 3000);

    return () =>
      window.clearInterval(timer);
  }, []);

  /* =======================================================
     GLOBAL VIOLATIONS
  ======================================================= */

  const openViolations = useMemo(
    () =>
      violations.filter(
        violation =>
          !isResolved(violation.status)
      ),
    [violations]
  );

  

  const criticalViolations = useMemo(
    () =>
      openViolations.filter(
        violation =>
          severityValue(
            violation.severity
          ) === 4
      ),
    [openViolations]
  );

  const highViolations = useMemo(
    () =>
      openViolations.filter(
        violation =>
          severityValue(
            violation.severity
          ) === 3
      ),
    [openViolations]
  );

  const mediumViolations = useMemo(
    () =>
      openViolations.filter(
        violation =>
          severityValue(
            violation.severity
          ) === 2
      ),
    [openViolations]
  );

  /* =======================================================
     LATEST RISK
  ======================================================= */

  const latestRiskScore = useMemo(() => {
    const scores = inspections
      .map(inspection =>
        Number(
          inspection.risk_score || 0
        )
      )
      .filter(
        score => !Number.isNaN(score)
      );

    if (scores.length === 0) {
      return 0;
    }

    return Math.max(...scores);
  }, [inspections]);

  /* =======================================================
     OVERALL RISK
  ======================================================= */

  const overallRisk = useMemo(() => {
    if (
      criticalViolations.length > 0
    ) {
      return "CRITICAL";
    }

    if (
      highViolations.length > 0 ||
      latestRiskScore >= 70
    ) {
      return "HIGH";
    }

    if (
      mediumViolations.length > 0 ||
      latestRiskScore >= 40
    ) {
      return "MEDIUM";
    }

    return "LOW";
  }, [
    criticalViolations,
    highViolations,
    mediumViolations,
    latestRiskScore,
  ]);

  /* =======================================================
     OVERALL COMPLIANCE
  ======================================================= */

  const compliancePercentage = useMemo(() => {
    if (openViolations.length === 0) {
      return 100;
    }

    const totalPenalty =
      openViolations.reduce(
        (penalty, violation) => {
          const severity =
            severityValue(
              violation.severity
            );

          if (severity === 4) {
            return penalty + 30;
          }

          if (severity === 3) {
            return penalty + 20;
          }

          if (severity === 2) {
            return penalty + 10;
          }

          return penalty + 5;
        },
        0
      );

    return Math.max(
      0,
      Math.round(
        100 - totalPenalty
      )
    );
  }, [openViolations]);

  /* =======================================================
     ESCALATED CASES
  ======================================================= */

  const escalatedCases = useMemo(
    () =>
      openViolations.filter(
        violation =>
          severityValue(
            violation.severity
          ) >= 3
      ),
    [openViolations]
  );

  /* =======================================================
     RECENT INSPECTIONS
  ======================================================= */

  const recentInspections = useMemo(
    () =>
      [...inspections]
        .sort(
          (a, b) =>
            new Date(
              b.created_at || 0
            ).getTime() -
            new Date(
              a.created_at || 0
            ).getTime()
        )
        .slice(0, 8),
    [inspections]
  );

  /* =======================================================
     MINE-WISE GOVERNANCE
  ======================================================= */

  const mineGovernance =
    useMemo<MineGovernance[]>(() => {
      return mines.map(mine => {
        const mineName =
          normalize(
            getMineName(mine)
          );

        const mineInspections =
          inspections.filter(
            inspection =>
              getInspectionMineName(
                inspection
              ) === mineName
          );

        const mineViolations =
          violations.filter(
            violation =>
              getViolationMineName(
                violation
              ) === mineName
          );

        const mineOpenViolations =
          mineViolations.filter(
            violation =>
              !isResolved(
                violation.status
              )
          );

        const criticalHigh =
          mineOpenViolations.filter(
            violation =>
              severityValue(
                violation.severity
              ) >= 3
          ).length;

        const compliance =
          typeof mine.compliance ===
          "number"
            ? Math.max(
                0,
                Math.min(
                  100,
                  Number(
                    mine.compliance
                  )
                )
              )
            : calculateMineCompliance(
                mineOpenViolations
              );

        const riskResult =
          calculateMineRisk(
            mineInspections,
            mineOpenViolations
          );

        const governance =
          calculateGovernanceStatus(
            compliance,
            riskResult.level,
            criticalHigh
          );

        return {
          mine,
          inspections:
            mineInspections,
          violations:
            mineViolations,
          openViolations:
            mineOpenViolations,
          criticalHigh,
          compliance,
          risk: riskResult.level,
          latestRiskScore:
            riskResult.score,
          governance,
        };
      });
    }, [
      mines,
      inspections,
      violations,
    ]);

  /* =======================================================
     GOVERNANCE COUNTS
  ======================================================= */

  const escalatedMines =
    useMemo(
      () =>
        mineGovernance.filter(
          mine =>
            mine.governance ===
            "ESCALATED"
        ).length,
      [mineGovernance]
    );

  const attentionMines =
    useMemo(
      () =>
        mineGovernance.filter(
          mine =>
            mine.governance ===
            "ATTENTION"
        ).length,
      [mineGovernance]
    );

  const compliantMines =
    useMemo(
      () =>
        mineGovernance.filter(
          mine =>
            mine.governance ===
            "COMPLIANT"
        ).length,
      [mineGovernance]
    );

  const currentDate =
    new Date().toLocaleDateString(
      "en-IN",
      {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }
    );

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="cg-layout">

      {/* =================================================
          SIDEBAR
      ================================================= */}

      <aside className="cg-sidebar">

        <div className="cg-sidebar-section">
          Authority
        </div>

        <button
          type="button"
          className="cg-sidebar-item active"
        >
          <span>01</span>
          Authority Overview
        </button>

        <button
          type="button"
          className="cg-sidebar-item"
        >
          <span>02</span>
          Mine Oversight
        </button>

        <button
          type="button"
          className="cg-sidebar-item"
        >
          <span>03</span>
          Compliance Status
        </button>

        <button
          type="button"
          className="cg-sidebar-item"
        >
          <span>04</span>
          Risk & Violations
        </button>

        <button
          type="button"
          className="cg-sidebar-item"
        >
          <span>05</span>
          Escalations
        </button>

        <div className="cg-sidebar-section">
          Accountability
        </div>

        <button
          type="button"
          className="cg-sidebar-item"
        >
          <span>06</span>
          Inspection Oversight
        </button>

        <button
          type="button"
          className="cg-sidebar-item"
        >
          <span>07</span>
          Audit & Accountability
        </button>

        <button
          type="button"
          className="cg-sidebar-item"
        >
          <span>08</span>
          Regulatory Reports
        </button>

        <div className="cg-sidebar-section">
          Intelligence
        </div>

        <button
          type="button"
          className="cg-sidebar-item"
        >
          <span>09</span>
          Mine Risk Map
        </button>

      </aside>

      {/* =================================================
          MAIN
      ================================================= */}

      <main className="cg-main">

        <div className="cg-main-inner">

          {/* =================================================
              HEADER
          ================================================= */}

          <section className="cg-page-header">

            <div>

              <p className="cg-page-eyebrow">
                Coal Mine Governance System
              </p>

              <h1 className="cg-page-title">
                Authority Overview
              </h1>

              <p className="cg-page-description">
                Regulatory oversight of mine
                compliance, inspections,
                violations, risk exposure,
                escalations and accountability.
              </p>

            </div>

            <div className="cg-date-label">
              REPORTING DATE

              <strong>
                {currentDate}
              </strong>
            </div>

          </section>

          {/* =================================================
              BACKEND STATUS
          ================================================= */}

          <section
            className="cg-panel"
            style={{
              marginBottom: "14px",
            }}
          >

            <div
              className="cg-panel-body"
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems: "center",
                gap: "15px",
                flexWrap: "wrap",
              }}
            >

              <div>

                <div className="cg-kpi-label">
                  GOVERNANCE DATA SOURCE
                </div>

                <div
                  style={{
                    marginTop: "5px",
                    fontSize: "13px",
                    fontWeight: 700,
                  }}
                >
                  SQLite + CoalGuard API
                </div>

                {lastUpdated && (
                  <div className="cg-kpi-note">
                    Last updated{" "}
                    {lastUpdated}
                  </div>
                )}

              </div>

              <span
                className={`cg-status ${
                  backendError
                    ? "cg-status-critical"
                    : "cg-status-low"
                }`}
              >
                <span className="cg-status-dot" />

                {backendError
                  ? "API ERROR"
                  : "LIVE GOVERNANCE LINK"}
              </span>

            </div>

          </section>

          {/* =================================================
              ERROR
          ================================================= */}

          {backendError && (
            <section
              className="cg-panel"
              style={{
                marginBottom: "14px",
                borderColor:
                  "rgba(239,68,68,.4)",
              }}
            >

              <div className="cg-panel-body">

                <strong
                  style={{
                    color: "#f87171",
                  }}
                >
                  Backend connection error
                </strong>

                <p
                  style={{
                    color:
                      "var(--cg-text-secondary)",
                    fontSize: "11px",
                    marginBottom: 0,
                  }}
                >
                  {backendError}
                </p>

              </div>

            </section>
          )}

          {/* =================================================
              KPI STRIP
          ================================================= */}

          <section className="cg-kpi-grid">

            <div className="cg-kpi">

              <div className="cg-kpi-label">
                Registered Mines
              </div>

              <div className="cg-kpi-value">
                {mines.length}
              </div>

              <div className="cg-kpi-note">
                Mines in governance database
              </div>

            </div>

            <div className="cg-kpi">

              <div className="cg-kpi-label">
                Field Inspections
              </div>

              <div className="cg-kpi-value">
                {inspections.length}
              </div>

              <div className="cg-kpi-note">
                Backend inspection records
              </div>

            </div>

            <div className="cg-kpi">

              <div className="cg-kpi-label">
                Overall Compliance
              </div>

              <div className="cg-kpi-value">
                {compliancePercentage}%
              </div>

              <div className="cg-kpi-note">
                Current governance position
              </div>

            </div>

            <div className="cg-kpi">

              <div className="cg-kpi-label">
                Open Violations
              </div>

              <div className="cg-kpi-value">
                {openViolations.length}
              </div>

              <div className="cg-kpi-note">
                Awaiting corrective action
              </div>

            </div>

            <div className="cg-kpi">

              <div className="cg-kpi-label">
                Critical / High
              </div>

              <div className="cg-kpi-value">
                {
                  criticalViolations.length +
                  highViolations.length
                }
              </div>

              <div className="cg-kpi-note">
                Regulatory attention required
              </div>

            </div>

          </section>

          {/* =================================================
              GOVERNANCE POSITION
          ================================================= */}

          <div
            className="cg-dashboard-grid"
            style={{
              marginTop: "14px",
            }}
          >

            <section className="cg-panel">

              <div className="cg-panel-header">

                <div>

                  <h2 className="cg-panel-title">
                    Governance Position
                  </h2>

                  <p className="cg-panel-subtitle">
                    System-wide regulatory condition
                  </p>

                </div>

                <span
                  className={`cg-status ${
                    compliancePercentage >= 90
                      ? "cg-status-low"
                      : compliancePercentage >= 75
                      ? "cg-status-moderate"
                      : "cg-status-critical"
                  }`}
                >
                  <span className="cg-status-dot" />
                  {compliancePercentage}%
                </span>

              </div>

              <div className="cg-panel-body">

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(2, 1fr)",
                    gap: "1px",
                    background:
                      "var(--cg-border)",
                    border:
                      "1px solid var(--cg-border)",
                  }}
                >

                  <div
                    style={{
                      padding: "18px",
                      background:
                        "var(--cg-surface-2)",
                    }}
                  >

                    <div className="cg-kpi-label">
                      COMPLIANCE
                    </div>

                    <div
                      style={{
                        marginTop: "6px",
                        fontSize: "25px",
                        fontWeight: 700,
                      }}
                    >
                      {compliancePercentage}%
                    </div>

                  </div>

                  <div
                    style={{
                      padding: "18px",
                      background:
                        "var(--cg-surface-2)",
                    }}
                  >

                    <div className="cg-kpi-label">
                      SYSTEM RISK
                    </div>

                    <div
                      style={{
                        marginTop: "6px",
                        fontSize: "25px",
                        fontWeight: 700,
                      }}
                    >
                      {overallRisk}
                    </div>

                  </div>

                </div>

                <div
                  style={{
                    marginTop: "15px",
                    display: "grid",
                    gap: "8px",
                  }}
                >

                  <div
                    style={{
                      padding: "11px",
                      border:
                        "1px solid var(--cg-border)",
                      background:
                        "var(--cg-surface-2)",
                      fontSize: "10px",
                    }}
                  >
                    <strong>
                      Registered mines:
                    </strong>{" "}
                    {mines.length}
                  </div>

                  <div
                    style={{
                      padding: "11px",
                      border:
                        "1px solid var(--cg-border)",
                      background:
                        "var(--cg-surface-2)",
                      fontSize: "10px",
                    }}
                  >
                    <strong>
                      Compliant mines:
                    </strong>{" "}
                    {compliantMines}
                  </div>

                  <div
                    style={{
                      padding: "11px",
                      border:
                        "1px solid var(--cg-border)",
                      background:
                        "var(--cg-surface-2)",
                      fontSize: "10px",
                    }}
                  >
                    <strong>
                      Mines requiring attention:
                    </strong>{" "}
                    {attentionMines}
                  </div>

                  <div
                    style={{
                      padding: "11px",
                      border:
                        "1px solid var(--cg-border)",
                      background:
                        "var(--cg-surface-2)",
                      fontSize: "10px",
                    }}
                  >
                    <strong>
                      Escalated mines:
                    </strong>{" "}
                    {escalatedMines}
                  </div>

                </div>

              </div>

            </section>

            {/* =================================================
                RISK POSITION
            ================================================= */}

            <section className="cg-panel">

              <div className="cg-panel-header">

                <div>

                  <h2 className="cg-panel-title">
                    Regulatory Risk Position
                  </h2>

                  <p className="cg-panel-subtitle">
                    Highest risk currently detected
                  </p>

                </div>

                <span
                  className={`cg-status ${
                    riskClass(overallRisk)
                  }`}
                >
                  <span className="cg-status-dot" />
                  {overallRisk}
                </span>

              </div>

              <div className="cg-panel-body">

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(4, 1fr)",
                    gap: "1px",
                    background:
                      "var(--cg-border)",
                    border:
                      "1px solid var(--cg-border)",
                  }}
                >

                  <div
                    style={{
                      padding: "14px",
                      background:
                        "var(--cg-surface-2)",
                    }}
                  >

                    <div className="cg-kpi-label">
                      Critical
                    </div>

                    <div
                      style={{
                        marginTop: "6px",
                        fontSize: "21px",
                        fontWeight: 700,
                      }}
                    >
                      {criticalViolations.length}
                    </div>

                  </div>

                  <div
                    style={{
                      padding: "14px",
                      background:
                        "var(--cg-surface-2)",
                    }}
                  >

                    <div className="cg-kpi-label">
                      High
                    </div>

                    <div
                      style={{
                        marginTop: "6px",
                        fontSize: "21px",
                        fontWeight: 700,
                      }}
                    >
                      {highViolations.length}
                    </div>

                  </div>

                  <div
                    style={{
                      padding: "14px",
                      background:
                        "var(--cg-surface-2)",
                    }}
                  >

                    <div className="cg-kpi-label">
                      Medium
                    </div>

                    <div
                      style={{
                        marginTop: "6px",
                        fontSize: "21px",
                        fontWeight: 700,
                      }}
                    >
                      {mediumViolations.length}
                    </div>

                  </div>

                  <div
                    style={{
                      padding: "14px",
                      background:
                        "var(--cg-surface-2)",
                    }}
                  >

                    <div className="cg-kpi-label">
                      GPS Alerts
                    </div>

                    <div
                      style={{
                        marginTop: "6px",
                        fontSize: "21px",
                        fontWeight: 700,
                      }}
                    >
                      {fraudAlerts.length}
                    </div>

                  </div>

                </div>

                <div
                  style={{
                    marginTop: "15px",
                    padding: "12px",
                    border:
                      "1px solid var(--cg-border)",
                    background:
                      "var(--cg-surface-2)",
                    fontSize: "10px",
                  }}
                >

                  <strong>
                    Highest inspection risk score:
                  </strong>{" "}
                  {latestRiskScore}

                </div>

              </div>

            </section>

          </div>

          {/* =================================================
              MINE-WISE GOVERNANCE
          ================================================= */}

          <section
            className="cg-panel"
            style={{
              marginTop: "14px",
            }}
          >

            <div className="cg-panel-header">

              <div>

                <h2 className="cg-panel-title">
                  Mine-wise Governance
                </h2>

                <p className="cg-panel-subtitle">
                  Live regulatory position for every
                  registered mine
                </p>

              </div>

              <span className="cg-status cg-status-low">
                {mineGovernance.length} Mines
              </span>

            </div>

            <div className="cg-panel-body">

              {mineGovernance.length === 0 ? (

                <div
                  style={{
                    padding: "18px",
                    border:
                      "1px solid var(--cg-border)",
                    background:
                      "var(--cg-surface-2)",
                  }}
                >

                  <strong>
                    No registered mines found.
                  </strong>

                  <p
                    style={{
                      marginBottom: 0,
                      marginTop: "6px",
                      color:
                        "var(--cg-text-secondary)",
                      fontSize: "11px",
                    }}
                  >
                    The governance API is not
                    currently returning mine records.
                  </p>

                </div>

              ) : (

                <div
                  style={{
                    overflowX: "auto",
                    border:
                      "1px solid var(--cg-border)",
                  }}
                >

                  <table
                    style={{
                      width: "100%",
                      minWidth: "950px",
                      borderCollapse:
                        "collapse",
                      fontSize: "10px",
                    }}
                  >

                    <thead>

                      <tr
                        style={{
                          background:
                            "var(--cg-surface-2)",
                          textAlign: "left",
                        }}
                      >

                        <th
                          style={{
                            padding: "12px",
                            borderBottom:
                              "1px solid var(--cg-border)",
                          }}
                        >
                          MINE
                        </th>

                        <th
                          style={{
                            padding: "12px",
                            borderBottom:
                              "1px solid var(--cg-border)",
                          }}
                        >
                          INSPECTIONS
                        </th>

                        <th
                          style={{
                            padding: "12px",
                            borderBottom:
                              "1px solid var(--cg-border)",
                          }}
                        >
                          OPEN VIOLATIONS
                        </th>

                        <th
                          style={{
                            padding: "12px",
                            borderBottom:
                              "1px solid var(--cg-border)",
                          }}
                        >
                          CRITICAL / HIGH
                        </th>

                        <th
                          style={{
                            padding: "12px",
                            borderBottom:
                              "1px solid var(--cg-border)",
                          }}
                        >
                          COMPLIANCE
                        </th>

                        <th
                          style={{
                            padding: "12px",
                            borderBottom:
                              "1px solid var(--cg-border)",
                          }}
                        >
                          RISK
                        </th>

                        <th
                          style={{
                            padding: "12px",
                            borderBottom:
                              "1px solid var(--cg-border)",
                          }}
                        >
                          GOVERNANCE
                        </th>

                      </tr>

                    </thead>

                    <tbody>

                      {mineGovernance.map(
                        record => (

                          <tr
                            key={record.mine.id}
                            style={{
                              borderBottom:
                                "1px solid var(--cg-border)",
                            }}
                          >

                            {/* MINE */}

                            <td
                              style={{
                                padding:
                                  "13px 12px",
                              }}
                            >

                              <strong
                                style={{
                                  display: "block",
                                  fontSize: "11px",
                                }}
                              >
                                {getMineName(
                                  record.mine
                                )}
                              </strong>

                              <span
                                style={{
                                  display: "block",
                                  marginTop: "4px",
                                  color:
                                    "var(--cg-text-muted)",
                                  fontSize: "9px",
                                }}
                              >
                                ID #
                                {record.mine.id}

                                {record.mine
                                  .location_name &&
                                  ` • ${record.mine.location_name}`}
                              </span>

                            </td>

                            {/* INSPECTIONS */}

                            <td
                              style={{
                                padding:
                                  "13px 12px",
                              }}
                            >
                              <strong>
                                {
                                  record
                                    .inspections
                                    .length
                                }
                              </strong>
                            </td>

                            {/* OPEN VIOLATIONS */}

                            <td
                              style={{
                                padding:
                                  "13px 12px",
                              }}
                            >

                              <span
                                className={
                                  record
                                    .openViolations
                                    .length > 0
                                    ? "cg-status cg-status-high"
                                    : "cg-status cg-status-low"
                                }
                              >
                                {
                                  record
                                    .openViolations
                                    .length
                                }
                              </span>

                            </td>

                            {/* CRITICAL / HIGH */}

                            <td
                              style={{
                                padding:
                                  "13px 12px",
                              }}
                            >

                              <span
                                className={
                                  record.criticalHigh > 0
                                    ? "cg-status cg-status-critical"
                                    : "cg-status cg-status-low"
                                }
                              >
                                {
                                  record.criticalHigh
                                }
                              </span>

                            </td>

                            {/* COMPLIANCE */}

                            <td
                              style={{
                                padding:
                                  "13px 12px",
                              }}
                            >

                              <div
                                style={{
                                  display: "flex",
                                  alignItems:
                                    "center",
                                  gap: "8px",
                                }}
                              >

                                <strong>
                                  {
                                    record.compliance
                                  }
                                  %
                                </strong>

                                <div
                                  style={{
                                    width: "70px",
                                    height: "5px",
                                    background:
                                      "var(--cg-border)",
                                    overflow:
                                      "hidden",
                                  }}
                                >

                                  <div
                                    style={{
                                      width: `${record.compliance}%`,
                                      height: "100%",
                                      background:
                                        "currentColor",
                                    }}
                                  />

                                </div>

                              </div>

                            </td>

                            {/* RISK */}

                            <td
                              style={{
                                padding:
                                  "13px 12px",
                              }}
                            >

                              <span
                                className={`cg-status ${riskClass(
                                  record.risk
                                )}`}
                              >

                                <span className="cg-status-dot" />

                                {record.risk}

                              </span>

                              <div
                                style={{
                                  marginTop: "4px",
                                  color:
                                    "var(--cg-text-muted)",
                                  fontSize: "9px",
                                }}
                              >
                                Score{" "}
                                {
                                  record.latestRiskScore
                                }
                              </div>

                            </td>

                            {/* GOVERNANCE */}

                            <td
                              style={{
                                padding:
                                  "13px 12px",
                              }}
                            >

                              <span
                                className={`cg-status ${governanceClass(
                                  record.governance
                                )}`}
                              >

                                <span className="cg-status-dot" />

                                {
                                  record.governance
                                }

                              </span>

                            </td>

                          </tr>

                        )
                      )}

                    </tbody>

                  </table>

                </div>

              )}

            </div>

          </section>

          {/* =================================================
              REGULATORY ESCALATIONS
          ================================================= */}

          <section
            className="cg-panel"
            style={{
              marginTop: "14px",
            }}
          >

            <div className="cg-panel-header">

              <div>

                <h2 className="cg-panel-title">
                  Regulatory Escalations
                </h2>

                <p className="cg-panel-subtitle">
                  Critical and high-severity cases
                  requiring authority visibility
                </p>

              </div>

              <span className="cg-status cg-status-critical">
                {escalatedCases.length} Cases
              </span>

            </div>

            <div className="cg-panel-body">

              {escalatedCases.length === 0 ? (

                <div
                  style={{
                    padding: "16px",
                    border:
                      "1px solid var(--cg-border)",
                    background:
                      "var(--cg-surface-2)",
                  }}
                >

                  <p
                    style={{
                      margin: 0,
                      color:
                        "var(--cg-text-secondary)",
                      fontSize: "11px",
                    }}
                  >
                    No critical or high-severity
                    violations are currently open.
                  </p>

                </div>

              ) : (

                <div
                  style={{
                    display: "grid",
                    gap: "9px",
                  }}
                >

                  {escalatedCases
                    .slice(0, 8)
                    .map(violation => (

                      <div
                        key={violation.id}
                        style={{
                          padding: "13px",
                          border:
                            "1px solid var(--cg-border)",
                          background:
                            "var(--cg-surface-2)",
                        }}
                      >

                        <div
                          style={{
                            display: "flex",
                            justifyContent:
                              "space-between",
                            gap: "10px",
                            flexWrap: "wrap",
                          }}
                        >

                          <strong>
                            {violation.title}
                          </strong>

                          <span
                            className={`cg-status ${
                              severityValue(
                                violation.severity
                              ) === 4
                                ? "cg-status-critical"
                                : "cg-status-high"
                            }`}
                          >
                            {violation.severity}
                          </span>

                        </div>

                        <div
                          style={{
                            marginTop: "7px",
                            color:
                              "var(--cg-text-secondary)",
                            fontSize: "10px",
                          }}
                        >
                          {violation.category}
                          {" • "}
                          Inspection #
                          {violation
                            .inspection_id ??
                            "N/A"}
                          {" • "}
                          {violation.status}
                        </div>

                        <div
                          style={{
                            marginTop: "5px",
                            color:
                              "var(--cg-text-muted)",
                            fontSize: "9px",
                          }}
                        >
                          Mine:{" "}
                          {violation
                            .location_name ||
                            "Unknown"}

                          {" • "}

                          Reported by:{" "}
                          {violation
                            .reported_by ||
                            "Unknown"}
                        </div>

                      </div>

                    ))}

                </div>

              )}

            </div>

          </section>

          {/* =================================================
              INSPECTION OVERSIGHT
          ================================================= */}

          <section
            className="cg-panel"
            style={{
              marginTop: "14px",
            }}
          >

            <div className="cg-panel-header">

              <div>

                <h2 className="cg-panel-title">
                  Inspection Oversight
                </h2>

                <p className="cg-panel-subtitle">
                  Latest field activity received by
                  the governance system
                </p>

              </div>

              <span className="cg-status cg-status-low">
                {inspections.length} Total
              </span>

            </div>

            <div className="cg-panel-body">

              {recentInspections.length === 0 ? (

                <p
                  style={{
                    color:
                      "var(--cg-text-secondary)",
                    fontSize: "11px",
                  }}
                >
                  No inspections available.
                </p>

              ) : (

                <div
                  style={{
                    display: "grid",
                    gap: "9px",
                  }}
                >

                  {recentInspections.map(
                    inspection => {

                      const score =
                        Number(
                          inspection
                            .risk_score || 0
                        );

                      const level =
                        riskLabel(
                          score,
                          inspection.risk_level
                        );

                      return (

                        <div
                          key={inspection.id}
                          style={{
                            padding: "13px",
                            border:
                              "1px solid var(--cg-border)",
                            background:
                              "var(--cg-surface-2)",
                          }}
                        >

                          <div
                            style={{
                              display: "flex",
                              justifyContent:
                                "space-between",
                              alignItems:
                                "center",
                              gap: "10px",
                              flexWrap:
                                "wrap",
                            }}
                          >

                            <strong>
                              Inspection #
                              {inspection.id}
                            </strong>

                            <span
                              className={`cg-status ${riskClass(
                                level
                              )}`}
                            >
                              {level}
                            </span>

                          </div>

                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns:
                                "repeat(auto-fit, minmax(140px, 1fr))",
                              gap: "8px",
                              marginTop: "9px",
                              color:
                                "var(--cg-text-secondary)",
                              fontSize: "10px",
                            }}
                          >

                            <div>
                              <strong>
                                Inspector
                              </strong>
                              <br />

                              {inspection
                                .inspector_name ||
                                "Unknown"}
                            </div>

                            <div>
                              <strong>
                                Mine
                              </strong>
                              <br />

                              {inspection
                                .location_name ||
                                "Unknown"}
                            </div>

                            <div>
                              <strong>
                                Risk Score
                              </strong>
                              <br />

                              {score}
                            </div>

                            <div>
                              <strong>
                                GPS Distance
                              </strong>
                              <br />

                              {Number(
                                inspection
                                  .distance_meters ||
                                  0
                              ).toFixed(1)}{" "}
                              m
                            </div>

                          </div>

                          <div
                            style={{
                              marginTop: "9px",
                              padding: "9px",
                              background:
                                "var(--cg-surface)",
                              color:
                                "var(--cg-text-secondary)",
                              fontSize: "10px",
                              lineHeight: 1.5,
                            }}
                          >

                            <strong>
                              Observation:
                            </strong>{" "}

                            {inspection
                              .observation ||
                              "No observation recorded."}

                          </div>

                        </div>

                      );
                    }
                  )}

                </div>

              )}

            </div>

          </section>

          {/* =================================================
              MINE MAP
          ================================================= */}

          <section
            className="cg-panel"
            style={{
              marginTop: "14px",
            }}
          >

            <div className="cg-panel-header">

              <div>

                <h2 className="cg-panel-title">
                  Mine Risk Map
                </h2>

                <p className="cg-panel-subtitle">
                  Geographic overview of registered
                  mining operations
                </p>

              </div>

              <span className="cg-status cg-status-low">
                {mines.length} Mines
              </span>

            </div>

            <div className="cg-panel-body">
              <MineMap />
            </div>

          </section>

          {/* =================================================
              AUDIT
          ================================================= */}

          <section
            className="cg-panel"
            style={{
              marginTop: "14px",
            }}
          >

            <div className="cg-panel-header">

              <div>

                <h2 className="cg-panel-title">
                  Audit & Accountability
                </h2>

                <p className="cg-panel-subtitle">
                  Governance-level verification of
                  system events and actions
                </p>

              </div>

              <span className="cg-status">
                SHA-256
              </span>

            </div>

            <div className="cg-panel-body">
              <AuditLedger />
            </div>

          </section>

          {/* =================================================
              REPORTS
          ================================================= */}

          <section
            className="cg-panel"
            style={{
              marginTop: "14px",
            }}
          >

            <div className="cg-panel-header">

              <div>

                <h2 className="cg-panel-title">
                  Regulatory Reports
                </h2>

                <p className="cg-panel-subtitle">
                  Compliance, inspection and violation
                  reporting
                </p>

              </div>

            </div>

            <div className="cg-panel-body">
              <ComplianceReports />
            </div>

          </section>

          {/* =================================================
              FOOTER
          ================================================= */}

          <footer className="cg-footer">

            <div>

              <strong
                style={{
                  color:
                    "var(--cg-text)",
                }}
              >
                COALGUARD
              </strong>

              {" "}— Governance &
              Regulatory Authority

            </div>

            <div
              style={{
                marginTop: "5px",
              }}
            >
              Digital prototype • Regulatory
              Oversight • Compliance • Risk •
              Accountability
            </div>

          </footer>

        </div>

      </main>

    </div>
  );
}

export default AuthorityDashboard;