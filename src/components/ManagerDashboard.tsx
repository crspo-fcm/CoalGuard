import { useEffect, useMemo, useState } from "react";
import ViolationsManagement from "./ViolationsManagement";
import MineMap from "./MineMap";
import AuditLedger from "./AuditLedger";
import ComplianceReports from "./ComplianceReports";

import {
  deleteBackendInspection,
  getBackendInspections,
  type BackendInspection,
} from "../services/coalguardApi";

type BackendViolation = {
  id: number;
  inspection_id?: number | null;
  title: string;
  description?: string;
  category: string;
  severity: string;
  reported_by?: string;
  assigned_to?: string;
  corrective_action?: string;
  due_date?: string | null;
  status: string;
  resolution_note?: string;
  verified_by?: string;
  verified_at?: string | null;
  created_at?: string;
  inspection_observation?: string;
  inspector_name?: string;
  location_name?: string;
};

type BackendFraudAlert = {
  id: number;
  latitude: number;
  longitude: number;
  distance_meters: number;
  reason: string;
  created_at: string;
  inspector_name?: string;
  location_name?: string;
};

type DashboardInspection = BackendInspection & {
  risk_score?: number;
  risk_factors?: string[] | string;
  risk_recommendation?: string;
};

type AlertItem = {
  id: string;
  type: "Violation" | "GPS";
  title: string;
  severity: string;
  category: string;
  description: string;
  location: string;
  created_at: string;
};

const API_BASE = "http://localhost:3000/api";

const isResolved = (status?: string) =>
  String(status || "").toLowerCase() === "resolved";

const severityValue = (severity?: string) => {
  const value = String(severity || "").toLowerCase();

  if (value.includes("critical")) return 4;
  if (value.includes("high")) return 3;
  if (value.includes("medium") || value.includes("moderate")) return 2;
  return 1;
};

const getCategoryGroup = (category?: string) => {
  const value = String(category || "").toLowerCase();

  if (
    value.includes("environment") ||
    value.includes("flood") ||
    value.includes("ventilation")
  ) {
    return "Environment";
  }

  if (
    value.includes("production") ||
    value.includes("equipment")
  ) {
    return "Production";
  }

  if (
    value.includes("labour") ||
    value.includes("labor") ||
    value.includes("worker")
  ) {
    return "Labour";
  }

  return "Safety";
};

const formatDate = (value?: string | null) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
};

const getRiskLabel = (score: number) => {
  if (score >= 75) {
    return {
      label: "Critical",
      className: "cg-status-critical",
    };
  }

  if (score >= 50) {
    return {
      label: "High",
      className: "cg-status-high",
    };
  }

  if (score >= 25) {
    return {
      label: "Medium",
      className: "cg-status-medium",
    };
  }

  return {
    label: "Low",
    className: "cg-status-low",
  };
};

function ManagerDashboard() {
  const [backendInspections, setBackendInspections] = useState<
    DashboardInspection[]
  >([]);

  const [violations, setViolations] = useState<
    BackendViolation[]
  >([]);

  const [fraudAlerts, setFraudAlerts] = useState<
    BackendFraudAlert[]
  >([]);

  const [backendError, setBackendError] = useState("");

  const [lastUpdated, setLastUpdated] = useState<Date | null>(
    null
  );

  const [deletingInspectionId, setDeletingInspectionId] =
    useState<number | null>(null);

  /*
   * ============================================================
   * LOAD LIVE BACKEND DATA
   * ============================================================
   */

  const loadBackendData = async () => {
    try {
      const [
        inspectionData,
        violationResponse,
        fraudResponse,
      ] = await Promise.all([
        getBackendInspections(),

        fetch(`${API_BASE}/violations`),

        fetch(`${API_BASE}/inspections/fraud-alerts`),
      ]);

      if (!violationResponse.ok) {
        throw new Error("Failed to load violations.");
      }

      if (!fraudResponse.ok) {
        throw new Error("Failed to load GPS alerts.");
      }

      const violationData = await violationResponse.json();
      const fraudData = await fraudResponse.json();

      setBackendInspections(
        inspectionData as DashboardInspection[]
      );

      setViolations(
        Array.isArray(violationData)
          ? violationData
          : Array.isArray(violationData?.violations)
            ? violationData.violations
            : []
      );

      setFraudAlerts(
        Array.isArray(fraudData)
          ? fraudData
          : Array.isArray(fraudData?.alerts)
            ? fraudData.alerts
            : []
      );

      setBackendError("");
      setLastUpdated(new Date());
    } catch (error) {
      console.error(error);

      setBackendError(
        error instanceof Error
          ? error.message
          : "Backend connection failed."
      );
    }
  };

  /*
   * ============================================================
   * LIVE REFRESH
   * ============================================================
   */

  useEffect(() => {
    void loadBackendData();

    const interval = window.setInterval(() => {
      void loadBackendData();
    }, 3000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  /*
   * ============================================================
   * DELETE INSPECTION
   * ============================================================
   */

  const handleDeleteInspection = async (
    inspectionId: number
  ) => {
    const confirmed = window.confirm(
      `Delete inspection #${inspectionId}? This will permanently remove the inspection and its related backend records.`
    );

    if (!confirmed) return;

    try {
      setDeletingInspectionId(inspectionId);

      await deleteBackendInspection(inspectionId);

      setBackendInspections((current) =>
        current.filter(
          (inspection) =>
            inspection.id !== inspectionId
        )
      );

      setViolations((current) =>
        current.filter(
          (violation) =>
            violation.inspection_id !== inspectionId
        )
      );
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Failed to delete inspection."
      );
    } finally {
      setDeletingInspectionId(null);
    }
  };

  /*
   * ============================================================
   * ACTIVE / RESOLVED VIOLATIONS
   * ============================================================
   */

  const openViolations = useMemo(
    () =>
      violations.filter(
        (violation) =>
          !isResolved(violation.status)
      ),
    [violations]
  );

  const resolvedViolations = useMemo(
    () =>
      violations.filter(
        (violation) =>
          isResolved(violation.status)
      ),
    [violations]
  );

  /*
   * ============================================================
   * SEVERITY COUNTS
   * ============================================================
   */

  const criticalViolations = useMemo(
    () =>
      openViolations.filter(
        (violation) =>
          severityValue(
            violation.severity
          ) === 4
      ),
    [openViolations]
  );

  const highViolations = useMemo(
    () =>
      openViolations.filter(
        (violation) =>
          severityValue(
            violation.severity
          ) === 3
      ),
    [openViolations]
  );

  const mediumViolations = useMemo(
    () =>
      openViolations.filter(
        (violation) =>
          severityValue(
            violation.severity
          ) === 2
      ),
    [openViolations]
  );

  /*
   * ============================================================
   * CATEGORY COUNTS
   * ============================================================
   */

  const categoryCounts = useMemo(() => {
    const result: Record<string, number> = {
      Safety: 0,
      Environment: 0,
      Production: 0,
      Labour: 0,
    };

    openViolations.forEach((violation) => {
      const category = getCategoryGroup(
        violation.category
      );

      result[category] += 1;
    });

    return result;
  }, [openViolations]);

  /*
   * ============================================================
   * COMPLIANCE CALCULATION
   *
   * Backend-driven:
   * - No active violations = 100%
   * - Medium = 10 penalty
   * - High = 20 penalty
   * - Critical = 30 penalty
   * ============================================================
   */

  const getCategoryScore = (
    category: string
  ) => {
    const categoryViolations =
      openViolations.filter(
        (violation) =>
          getCategoryGroup(
            violation.category
          ) === category
      );

    if (categoryViolations.length === 0) {
      return 100;
    }

    let penalty = 0;

    categoryViolations.forEach(
      (violation) => {
        const severity = severityValue(
          violation.severity
        );

        if (severity === 4) {
          penalty += 30;
        } else if (severity === 3) {
          penalty += 20;
        } else if (severity === 2) {
          penalty += 10;
        } else {
          penalty += 5;
        }
      }
    );

    return Math.max(
      0,
      Math.round(100 - penalty)
    );
  };

  const safetyScore =
    getCategoryScore("Safety");

  const environmentScore =
    getCategoryScore("Environment");

  const productionScore =
    getCategoryScore("Production");

  const labourScore =
    getCategoryScore("Labour");

  const overallCompliance = Math.round(
    (
      safetyScore +
      environmentScore +
      productionScore +
      labourScore
    ) / 4
  );

  /*
   * ============================================================
   * RISK INTELLIGENCE
   * ============================================================
   */

  const inspectionRiskScores = useMemo(
    () =>
      backendInspections
        .map(
          (inspection) =>
            Number(
              inspection.risk_score
            ) || 0
        )
        .filter(
          (score) => score >= 0
        ),
    [backendInspections]
  );

  const highestInspectionRisk =
    inspectionRiskScores.length > 0
      ? Math.max(
          ...inspectionRiskScores
        )
      : 0;

  const violationRiskScore = Math.min(
    100,
    criticalViolations.length * 30 +
      highViolations.length * 20 +
      mediumViolations.length * 10
  );

  const mineRiskScore = Math.max(
    highestInspectionRisk,
    violationRiskScore
  );

  const mineRisk = getRiskLabel(
    mineRiskScore
  );

  /*
   * ============================================================
   * ACTIVE MANAGEMENT ALERTS
   *
   * IMPORTANT:
   * This is the SINGLE source used by the
   * "Active Alerts" count AND the displayed list.
   *
   * Therefore the number can never disagree with
   * the alerts shown below.
   * ============================================================
   */

  const managementAlerts =
    useMemo<AlertItem[]>(() => {
      const violationAlerts: AlertItem[] =
        openViolations
          .filter(
            (violation) =>
              severityValue(
                violation.severity
              ) >= 3
          )
          .map((violation) => ({
            id: `violation-${violation.id}`,
            type: "Violation",
            title: violation.title,
            severity: violation.severity,
            category: violation.category,
            description:
              violation.description ||
              violation.inspection_observation ||
              "Backend violation requires management attention.",
            location:
              violation.location_name ||
              "Mine site",
            created_at:
              violation.created_at ||
              "",
          }));

      const gpsAlerts: AlertItem[] =
        fraudAlerts.map((alert) => ({
          id: `gps-${alert.id}`,
          type: "GPS",
          title: "GPS Site Boundary Alert",
          severity: "High",
          category: "Field Verification",
          description:
            alert.reason ||
            `Inspector was ${alert.distance_meters}m from the registered site boundary.`,
          location:
            alert.location_name ||
            "Registered mine location",
          created_at:
            alert.created_at ||
            "",
        }));

      return [
        ...violationAlerts,
        ...gpsAlerts,
      ].sort(
        (a, b) =>
          new Date(
            b.created_at
          ).getTime() -
          new Date(
            a.created_at
          ).getTime()
      );
    }, [
      openViolations,
      fraudAlerts,
    ]);

  const totalActiveAlerts =
    managementAlerts.length;

  /*
   * ============================================================
   * LATEST INSPECTIONS
   * ============================================================
   */

  const latestInspections =
    useMemo(
      () =>
        [...backendInspections]
          .sort(
            (a, b) =>
              new Date(
                b.created_at
              ).getTime() -
              new Date(
                a.created_at
              ).getTime()
          )
          .slice(0, 8),
      [backendInspections]
    );

  const latestInspection =
    latestInspections[0];

  /*
   * ============================================================
   * CATEGORY DISPLAY
   * ============================================================
   */

  const categoryData = [
    {
      name: "Safety",
      score: safetyScore,
    },
    {
      name: "Environment",
      score: environmentScore,
    },
    {
      name: "Production",
      score: productionScore,
    },
    {
      name: "Labour",
      score: labourScore,
    },
  ];

  return (
    <section className="mt-8 px-4 pb-10">
      <div className="mx-auto max-w-7xl">

        {/* =====================================================
            HEADER
        ===================================================== */}

        <section className="cg-panel">
          <div className="cg-panel-header">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-400">
                Mine Operations
              </p>

              <h1 className="mt-2 text-3xl font-black text-white">
                Management Overview
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                Centralized monitoring of field
                inspections, compliance, violations,
                corrective actions, risk and
                GPS-based field alerts.
              </p>
            </div>

            <div className="text-right">
              <span className="cg-status cg-status-low">
                <span className="cg-status-dot" />
                LIVE SQLITE
              </span>

              <p className="mt-2 text-xs text-slate-500">
                {lastUpdated
                  ? `Updated ${lastUpdated.toLocaleTimeString()}`
                  : "Connecting..."}
              </p>
            </div>
          </div>

          {backendError && (
            <div className="mx-5 mb-5 rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
              Backend warning: {backendError}
            </div>
          )}
        </section>

        {/* =====================================================
            KPI STRIP
        ===================================================== */}

        <section className="cg-kpi-grid mt-4">

          <div className="cg-kpi">
            <div className="cg-kpi-label">
              Overall Compliance
            </div>

            <div className="cg-kpi-value">
              {overallCompliance}%
            </div>

            <div className="cg-kpi-note">
              Backend violation-based position
            </div>
          </div>

          <div className="cg-kpi">
            <div className="cg-kpi-label">
              Field Inspections
            </div>

            <div className="cg-kpi-value">
              {backendInspections.length}
            </div>

            <div className="cg-kpi-note">
              Live SQLite records
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
              Requiring corrective action
            </div>
          </div>

          <div className="cg-kpi">
            <div className="cg-kpi-label">
              Critical / High
            </div>

            <div className="cg-kpi-value">
              {criticalViolations.length +
                highViolations.length}
            </div>

            <div className="cg-kpi-note">
              Priority management cases
            </div>
          </div>

          <div className="cg-kpi">
            <div className="cg-kpi-label">
              Active Alerts
            </div>

            <div className="cg-kpi-value">
              {totalActiveAlerts}
            </div>

            <div className="cg-kpi-note">
              Violations + GPS alerts shown below
            </div>
          </div>

        </section>

        {/* =====================================================
            MANAGER ACTION SUMMARY
        ===================================================== */}

        <section
          className="cg-panel"
          style={{ marginTop: "14px" }}
        >
          <div className="cg-panel-header">
            <div>
              <h2 className="cg-panel-title">
                Manager Action Queue
              </h2>

              <p className="cg-panel-subtitle">
                Priority items requiring management attention
              </p>
            </div>

            <span
              className={`cg-status ${
                totalActiveAlerts > 0
                  ? "cg-status-critical"
                  : "cg-status-low"
              }`}
            >
              {totalActiveAlerts} Active
            </span>
          </div>

          <div className="cg-panel-body">

            {managementAlerts.length === 0 ? (
              <div className="rounded-xl border border-green-900/40 bg-green-950/20 p-5 text-sm text-green-300">
                No active high-priority management
                alerts are currently detected.
              </div>
            ) : (
              <div className="grid gap-3">

                {managementAlerts
                  .slice(0, 8)
                  .map((alert) => {
                    const severity =
                      severityValue(
                        alert.severity
                      );

                    const severityClass =
                      severity === 4
                        ? "cg-status-critical"
                        : severity === 3
                          ? "cg-status-high"
                          : "cg-status-medium";

                    return (
                      <div
                        key={alert.id}
                        className="rounded-xl border border-slate-800 bg-slate-950 p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">

                          <div>
                            <div className="flex flex-wrap items-center gap-2">

                              <span
                                className={`cg-status ${severityClass}`}
                              >
                                {alert.severity}
                              </span>

                              <span className="cg-status">
                                {alert.type}
                              </span>

                            </div>

                            <h3 className="mt-2 text-sm font-bold text-white">
                              {alert.title}
                            </h3>
                          </div>

                          <span className="text-xs text-slate-500">
                            {formatDate(
                              alert.created_at
                            )}
                          </span>
                        </div>

                        <p className="mt-2 text-sm leading-6 text-slate-400">
                          {alert.description}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                          <span>
                            Category: {alert.category}
                          </span>

                          <span>
                            Location: {alert.location}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                {managementAlerts.length > 8 && (
                  <p className="text-xs text-slate-500">
                    Showing 8 of{" "}
                    {managementAlerts.length} active
                    alerts.
                  </p>
                )}

              </div>
            )}
          </div>
        </section>

        {/* =====================================================
            COMPLIANCE + RISK
        ===================================================== */}

        <div
          className="cg-dashboard-grid"
          style={{ marginTop: "14px" }}
        >

          {/* COMPLIANCE */}

          <section className="cg-panel">
            <div className="cg-panel-header">
              <div>
                <h2 className="cg-panel-title">
                  Compliance Position
                </h2>

                <p className="cg-panel-subtitle">
                  Current compliance calculated from
                  active backend violations
                </p>
              </div>

              <span className="cg-status cg-status-low">
                {overallCompliance}%
              </span>
            </div>

            <div className="cg-panel-body">

              {categoryData.map(
                (category) => (
                  <div
                    className="cg-category-row"
                    key={category.name}
                  >
                    <div className="cg-category-head">
                      <span className="cg-category-name">
                        {category.name}
                      </span>

                      <span className="cg-category-score">
                        {category.score}%
                      </span>
                    </div>

                    <div className="cg-progress">
                      <div
                        className="cg-progress-fill"
                        style={{
                          width: `${category.score}%`,
                        }}
                      />
                    </div>
                  </div>
                )
              )}

              <div className="mt-5 grid grid-cols-2 gap-3">

                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <p className="text-xs text-slate-500">
                    Active violations
                  </p>

                  <p className="mt-1 text-2xl font-bold text-white">
                    {openViolations.length}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <p className="text-xs text-slate-500">
                    Resolved
                  </p>

                  <p className="mt-1 text-2xl font-bold text-green-400">
                    {resolvedViolations.length}
                  </p>
                </div>

              </div>
            </div>
          </section>

          {/* RISK */}

          <section className="cg-panel">
            <div className="cg-panel-header">
              <div>
                <h2 className="cg-panel-title">
                  Risk Intelligence
                </h2>

                <p className="cg-panel-subtitle">
                  Combined inspection and violation
                  risk indicators
                </p>
              </div>

              <span
                className={`cg-status ${mineRisk.className}`}
              >
                <span className="cg-status-dot" />
                {mineRisk.label} Risk
              </span>
            </div>

            <div className="cg-panel-body">

              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">

                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-slate-500">
                      Current Risk Score
                    </p>

                    <p className="mt-2 text-5xl font-black text-white">
                      {mineRiskScore}
                    </p>
                  </div>

                  <p className="text-sm text-slate-500">
                    / 100
                  </p>
                </div>

                <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-violet-500 transition-all"
                    style={{
                      width: `${mineRiskScore}%`,
                    }}
                  />
                </div>

              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">

                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <p className="text-xs text-slate-500">
                    Highest Inspection Risk
                  </p>

                  <p className="mt-1 text-2xl font-bold text-white">
                    {highestInspectionRisk}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <p className="text-xs text-slate-500">
                    Violation Risk
                  </p>

                  <p className="mt-1 text-2xl font-bold text-white">
                    {violationRiskScore}
                  </p>
                </div>

              </div>

              <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-4">

                <p className="text-xs uppercase tracking-wider text-slate-500">
                  Risk Factors
                </p>

                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">

                  <div>
                    Safety:{" "}
                    <strong>
                      {categoryCounts.Safety}
                    </strong>
                  </div>

                  <div>
                    Environment:{" "}
                    <strong>
                      {categoryCounts.Environment}
                    </strong>
                  </div>

                  <div>
                    Production:{" "}
                    <strong>
                      {categoryCounts.Production}
                    </strong>
                  </div>

                  <div>
                    Labour:{" "}
                    <strong>
                      {categoryCounts.Labour}
                    </strong>
                  </div>

                </div>

              </div>

            </div>
          </section>

        </div>

        {/* =====================================================
            LIVE FIELD INSPECTIONS
        ===================================================== */}

        <section
          className="cg-panel"
          style={{ marginTop: "14px" }}
        >
          <div className="cg-panel-header">

            <div>
              <h2 className="cg-panel-title">
                Live Field Inspections
              </h2>

              <p className="cg-panel-subtitle">
                Inspection records received from the
                CoalGuard SQLite backend
              </p>
            </div>

            <span className="cg-status cg-status-low">
              {backendInspections.length} Records
            </span>

          </div>

          <div className="cg-panel-body">

            {latestInspections.length === 0 ? (
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-5 text-sm text-slate-500">
                No backend inspections available.
              </div>
            ) : (
              <div className="grid gap-3">

                {latestInspections.map(
                  (inspection) => {

                    const score =
                      Number(
                        inspection.risk_score
                      ) || 0;

                    const risk =
                      getRiskLabel(score);

                    return (
                      <div
                        key={inspection.id}
                        className="rounded-xl border border-slate-800 bg-slate-950 p-4"
                      >

                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">

                          <div>

                            <div className="flex flex-wrap items-center gap-2">

                              <span className="text-sm font-bold text-white">
                                Inspection #
                                {inspection.id}
                              </span>

                              <span
                                className={`cg-status ${risk.className}`}
                              >
                                Risk {score}
                              </span>

                            </div>

                            <p className="mt-2 text-sm text-slate-300">
                              {inspection.observation ||
                                "No observation recorded."}
                            </p>

                            <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">

                              <span>
                                Inspector:{" "}
                                {inspection.inspector_name ||
                                  "Unknown"}
                              </span>

                              <span>
                                Location:{" "}
                                {inspection.location_name ||
                                  "Unknown"}
                              </span>

                              <span>
                                {formatDate(
                                  inspection.created_at
                                )}
                              </span>

                            </div>

                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              void handleDeleteInspection(
                                inspection.id
                              )
                            }
                            disabled={
                              deletingInspectionId ===
                              inspection.id
                            }
                            className="rounded-lg border border-red-900/60 bg-red-950/30 px-4 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-900/40 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {deletingInspectionId ===
                            inspection.id
                              ? "Deleting..."
                              : "Delete"}
                          </button>

                        </div>

                        {inspection.risk_recommendation && (
                          <div className="mt-3 rounded-lg border border-violet-900/30 bg-violet-950/20 px-3 py-2 text-xs text-violet-300">
                            Recommendation:{" "}
                            {
                              inspection.risk_recommendation
                            }
                          </div>
                        )}

                      </div>
                    );
                  }
                )}

              </div>
            )}

          </div>
        </section>

        {/* =====================================================
            MINE RISK MAP
        ===================================================== */}

        <section
          className="cg-panel"
          style={{ marginTop: "14px" }}
        >
          <div className="cg-panel-header">

            <div>
              <h2 className="cg-panel-title">
                Mine Risk Map
              </h2>

              <p className="cg-panel-subtitle">
                Geographic overview of mine locations
                and risk information
              </p>
            </div>

            <span className="cg-status">
              GIS / OSM
            </span>

          </div>

          <div className="cg-panel-body">
            <MineMap />
          </div>
        </section>

        {/* =====================================================
            VIOLATION BREAKDOWN
        ===================================================== */}

        <section
          className="cg-panel"
          style={{ marginTop: "14px" }}
        >
          <div className="cg-panel-header">

            <div>
              <h2 className="cg-panel-title">
                Violation Overview
                <ViolationsManagement /> 
              </h2>

              <p className="cg-panel-subtitle">
                Active backend violations requiring
                corrective action
              </p>
            </div>

            <span className="cg-status">
              {openViolations.length} Open
            </span>

          </div>

          <div className="cg-panel-body">

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">

              <div className="rounded-xl border border-red-900/40 bg-red-950/20 p-4">
                <p className="text-xs uppercase tracking-wider text-slate-500">
                  Critical
                </p>

                <p className="mt-2 text-3xl font-black text-red-400">
                  {criticalViolations.length}
                </p>
              </div>

              <div className="rounded-xl border border-orange-900/40 bg-orange-950/20 p-4">
                <p className="text-xs uppercase tracking-wider text-slate-500">
                  High
                </p>

                <p className="mt-2 text-3xl font-black text-orange-400">
                  {highViolations.length}
                </p>
              </div>

              <div className="rounded-xl border border-yellow-900/40 bg-yellow-950/20 p-4">
                <p className="text-xs uppercase tracking-wider text-slate-500">
                  Medium
                </p>

                <p className="mt-2 text-3xl font-black text-yellow-400">
                  {mediumViolations.length}
                </p>
              </div>

            </div>

          </div>
        </section>

        {/* =====================================================
            AUDIT LEDGER
        ===================================================== */}

        <section
          className="cg-panel"
          style={{ marginTop: "14px" }}
        >
          <div className="cg-panel-header">

            <div>
              <h2 className="cg-panel-title">
                Audit Ledger
              </h2>

              <p className="cg-panel-subtitle">
                Immutable backend activity and verification
                history
              </p>
            </div>

            <span className="cg-status cg-status-low">
              SQLITE
            </span>

          </div>

          <div className="cg-panel-body">
            <AuditLedger />
          </div>
        </section>

        {/* =====================================================
            COMPLIANCE REPORTS
        ===================================================== */}

        <ComplianceReports />

        {/* =====================================================
            LATEST INSPECTION SUMMARY
        ===================================================== */}

        {latestInspection && (
          <section
            className="cg-panel"
            style={{ marginTop: "14px" }}
          >
            <div className="cg-panel-header">

              <div>
                <h2 className="cg-panel-title">
                  Latest Inspection Decision
                </h2>

                <p className="cg-panel-subtitle">
                  Most recent field assessment available
                  to management
                </p>
              </div>

              <span
                className={`cg-status ${
                  getRiskLabel(
                    Number(
                      latestInspection.risk_score
                    ) || 0
                  ).className
                }`}
              >
                {
                  getRiskLabel(
                    Number(
                      latestInspection.risk_score
                    ) || 0
                  ).label
                }
              </span>

            </div>

            <div className="cg-panel-body">

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">

                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <p className="text-xs text-slate-500">
                    Inspection
                  </p>

                  <p className="mt-1 text-xl font-bold text-white">
                    #{latestInspection.id}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <p className="text-xs text-slate-500">
                    Risk Score
                  </p>

                  <p className="mt-1 text-xl font-bold text-white">
                    {Number(
                      latestInspection.risk_score
                    ) || 0}
                    /100
                  </p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <p className="text-xs text-slate-500">
                    Location
                  </p>

                  <p className="mt-1 text-sm font-bold text-white">
                    {latestInspection.location_name ||
                      "Unknown"}
                  </p>
                </div>

              </div>

              {latestInspection.risk_recommendation && (
                <div className="mt-4 rounded-xl border border-violet-900/30 bg-violet-950/20 p-4">
                  <p className="text-xs uppercase tracking-wider text-violet-400">
                    Recommended Management Action
                  </p>

                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {
                      latestInspection.risk_recommendation
                    }
                  </p>
                </div>
              )}

            </div>
          </section>
        )}

      </div>
    </section>
  );
}

export default ManagerDashboard;