import { useEffect, useState } from "react";
import { getBackendInspections, type BackendInspection } from "../services/coalguardApi";

type ComplianceItem = {
  id: number;
  title: string;
  status: "Compliant" | "Non-Compliant" | "Pending";
};

type ComplianceCategory = {
  id: string;
  name: string;
  icon: string;
  items: ComplianceItem[];
};

type Violation = {
  id: number;
  inspectionId: string;
  title: string;
  description: string;
  category: string;
  severity: string;
  reportedBy: string;
  assignedTo: string;
  correctiveAction: string;
  dueDate: string;
  status: string;
  resolutionNote: string;
  verifiedBy: string;
  verifiedAt: string;
  createdAt: string;
};

const COMPLIANCE_KEY = "coalguard_compliance";
const VIOLATION_KEY = "coalguard_violations";

function RiskIntelligence() {
  const [compliance, setCompliance] =
    useState<ComplianceCategory[]>([]);

  const [violations, setViolations] =
    useState<Violation[]>([]);

  const [riskScore, setRiskScore] = useState(0);

  const [riskLevel, setRiskLevel] =
    useState("Low Risk");

  const [riskFactors, setRiskFactors] =
    useState<string[]>([]);

  const [recommendations, setRecommendations] =
    useState<string[]>([]);

  const [complianceScore, setComplianceScore] =
    useState(0);

  const [openViolations, setOpenViolations] =
    useState(0);

  const [criticalViolations, setCriticalViolations] =
    useState(0);

  const [overdueActions, setOverdueActions] =
    useState(0);

  const [backendInspections, setBackendInspections] =
    useState<BackendInspection[]>([]);

  const [backendInspectionsLoading, setBackendInspectionsLoading] =
    useState(false);

  const [backendInspectionsError, setBackendInspectionsError] =
    useState("");

  const [repeatedCategory, setRepeatedCategory] =
    useState("None");

  const highRiskInspections = backendInspections.filter(
    (inspection) =>
      String(inspection.risk_level).toUpperCase() === "RED"
  );

  const loadData = () => {
    const savedCompliance =
      localStorage.getItem(COMPLIANCE_KEY);

    const savedViolations =
      localStorage.getItem(VIOLATION_KEY);

    if (savedCompliance) {
      try {
        const parsed =
          JSON.parse(savedCompliance);

        if (Array.isArray(parsed)) {
          setCompliance(parsed);
        }
      } catch {
        setCompliance([]);
      }
    } else {
      setCompliance([]);
    }

    if (savedViolations) {
      try {
        const parsed =
          JSON.parse(savedViolations);

        if (Array.isArray(parsed)) {
          setViolations(parsed);
        }
      } catch {
        setViolations([]);
      }
    } else {
      setViolations([]);
    }
  };

  useEffect(() => {
    loadData();

    const interval =
      window.setInterval(() => {
        loadData();
      }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  // Load real inspection risk data from the CoalGuard backend.
  useEffect(() => {
    let active = true;

    const loadBackendInspections = async () => {
      try {
        setBackendInspectionsLoading(true);

        const data = await getBackendInspections();

        if (!active) return;

        setBackendInspections(data);
        setBackendInspectionsError("");
      } catch (error) {
        if (!active) return;

        setBackendInspectionsError(
          error instanceof Error
            ? error.message
            : "Unable to load backend inspection data."
        );
      } finally {
        if (active) {
          setBackendInspectionsLoading(false);
        }
      }
    };

    loadBackendInspections();

    const interval = window.setInterval(
      loadBackendInspections,
      2000
    );

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    calculateRisk();
  }, [compliance, violations, backendInspections]);

  const calculateRisk = () => {
    let score = 0;

    const factors: string[] = [];
    const actions: string[] = [];

    let compliant = 0;
    let failed = 0;
    let pending = 0;

    compliance.forEach(
      (category) => {
        category.items.forEach(
          (item) => {
            if (
              item.status ===
              "Compliant"
            ) {
              compliant++;
            }

            if (
              item.status ===
              "Non-Compliant"
            ) {
              failed++;
            }

            if (
              item.status ===
              "Pending"
            ) {
              pending++;
            }
          }
        );
      }
    );

    const assessed =
      compliant + failed;

    let calculatedCompliance = 0;

    if (assessed > 0) {
      calculatedCompliance =
        Math.round(
          (compliant / assessed) * 100
        );
    }

    setComplianceScore(
      calculatedCompliance
    );

    /*
     * --------------------------------
     * COMPLIANCE RISK
     * --------------------------------
     */

    if (assessed === 0) {
      score += 15;

      factors.push(
        "No completed compliance assessment is available."
      );

      actions.push(
        "Complete the pending compliance assessment."
      );
    } else if (
      calculatedCompliance < 50
    ) {
      score += 40;

      factors.push(
        "Compliance performance is below 50%."
      );

      actions.push(
        "Immediately review failed compliance controls."
      );
    } else if (
      calculatedCompliance < 75
    ) {
      score += 25;

      factors.push(
        "Compliance performance requires improvement."
      );

      actions.push(
        "Prioritize non-compliant controls."
      );
    } else if (
      calculatedCompliance < 90
    ) {
      score += 10;

      factors.push(
        "Some compliance controls require attention."
      );

      actions.push(
        "Review remaining compliance gaps."
      );
    }

    /*
     * --------------------------------
     * PENDING CHECK RISK
     * --------------------------------
     */

    if (pending >= 5) {
      score += 10;

      factors.push(
        `${pending} compliance checks are still pending.`
      );

      actions.push(
        "Complete pending compliance checks."
      );
    } else if (pending > 0) {
      score += 3;

      factors.push(
        `${pending} compliance check(s) remain pending.`
      );
    }

    /*
     * --------------------------------
     * VIOLATION RISK
     * --------------------------------
     */

    const unresolved =
      violations.filter(
        (violation) =>
          violation.status !==
          "Resolved"
      );

    const critical =
      unresolved.filter(
        (violation) =>
          violation.severity ===
          "Critical"
      );

    const high =
      unresolved.filter(
        (violation) =>
          violation.severity ===
          "High"
      );

    setOpenViolations(
      unresolved.length
    );

    setCriticalViolations(
      critical.length
    );

    score +=
      unresolved.length * 5;

    score +=
      critical.length * 20;

    score +=
      high.length * 10;

    if (unresolved.length > 0) {
      factors.push(
        `${unresolved.length} unresolved violation(s) detected.`
      );

      actions.push(
        "Track all corrective actions until closure."
      );
    }

    if (critical.length > 0) {
      factors.push(
        `${critical.length} critical violation(s) remain unresolved.`
      );

      actions.push(
        "Escalate critical violations for immediate management review."
      );
    }

    if (high.length > 0) {
      factors.push(
        `${high.length} high-severity violation(s) remain unresolved.`
      );

      actions.push(
        "Prioritize high-severity corrective actions."
      );
    }

    /*
     * --------------------------------
     * OVERDUE ACTIONS
     * --------------------------------
     */

    const today =
      new Date();

    const overdue =
      unresolved.filter(
        (violation) => {
          if (!violation.dueDate) {
            return false;
          }

          const due =
            new Date(
              violation.dueDate +
                "T23:59:59"
            );

          return due < today;
        }
      );

    setOverdueActions(
      overdue.length
    );

    if (overdue.length > 0) {
      score +=
        overdue.length * 10;

      factors.push(
        `${overdue.length} corrective action(s) are overdue.`
      );

      actions.push(
        "Escalate overdue corrective actions."
      );
    }

    /*
     * --------------------------------
     * REPEATED VIOLATION CATEGORY
     * --------------------------------
     */

    const categoryCounts: {
      [key: string]: number;
    } = {};

    unresolved.forEach(
      (violation) => {
        const category =
          violation.category ||
          "Unknown";

        if (
          categoryCounts[
            category
          ] === undefined
        ) {
          categoryCounts[
            category
          ] = 0;
        }

        categoryCounts[
          category
        ]++;
      }
    );

    let highestCategory =
      "None";

    let highestCount = 0;

    Object.keys(
      categoryCounts
    ).forEach(
      (category) => {
        if (
          categoryCounts[
            category
          ] > highestCount
        ) {
          highestCount =
            categoryCounts[
              category
            ];

          highestCategory =
            category;
        }
      }
    );

    if (
      highestCount >= 2
    ) {
      score += 10;

      setRepeatedCategory(
        highestCategory
      );

      factors.push(
        `${highestCategory} has repeated unresolved violations.`
      );

      actions.push(
        `Investigate recurring ${highestCategory.toLowerCase()} compliance failures.`
      );
    } else {
      setRepeatedCategory(
        "None"
      );
    }

    /*
     * --------------------------------
     * LIVE BACKEND INSPECTION RISK
     * --------------------------------
     */

    const backendRedInspections =
      backendInspections.filter(
        (inspection) =>
          String(inspection.risk_level).toUpperCase() === "RED"
      );

    const backendGreenInspections =
      backendInspections.filter(
        (inspection) =>
          String(inspection.risk_level).toUpperCase() === "GREEN"
      );

    if (backendInspections.length > 0) {

      score += Math.min(
        backendRedInspections.length * 15,
        45
      );

      if (backendRedInspections.length > 0) {

        factors.push(
          `${backendRedInspections.length} live backend inspection(s) are classified RED.`
        );

        actions.push(
          "Review RED-risk field inspections and verify corrective action."
        );
      }

      if (backendRedInspections.length >= 3) {

        factors.push(
          "Multiple high-risk field inspections indicate an emerging site-level risk pattern."
        );

        actions.push(
          "Escalate repeated RED field findings for management review."
        );
      }

      if (
        backendRedInspections.length === 0 &&
        backendGreenInspections.length > 0
      ) {
        factors.push(
          "Recent backend field inspections are currently classified GREEN."
        );
      }

    } else {

      factors.push(
        "No live backend inspection records are currently available."
      );

      actions.push(
        "Continue field inspections to improve live risk visibility."
      );
    }

    /*
     * --------------------------------
     * LIMIT SCORE
     * --------------------------------
     */

    if (score > 100) {
      score = 100;
    }

    /*
     * --------------------------------
     * RISK LEVEL
     * --------------------------------
     */

    let level =
      "Low Risk";

    if (score >= 75) {
      level =
        "Critical Risk";
    } else if (score >= 50) {
      level =
        "High Risk";
    } else if (score >= 25) {
      level =
        "Medium Risk";
    }

    /*
     * --------------------------------
     * DEFAULT INFORMATION
     * --------------------------------
     */

    if (
      factors.length === 0
    ) {
      factors.push(
        "No significant risk indicators detected."
      );
    }

    if (
      actions.length === 0
    ) {
      actions.push(
        "Continue routine monitoring and periodic inspections."
      );
    }

    setRiskScore(score);
    setRiskLevel(level);
    setRiskFactors(factors);
    setRecommendations(actions);
  };

  const getRiskClass = () => {
    if (
      riskScore >= 75
    ) {
      return "border-red-400/30 bg-red-400/10 text-red-400";
    }

    if (
      riskScore >= 50
    ) {
      return "border-orange-400/30 bg-orange-400/10 text-orange-400";
    }

    if (
      riskScore >= 25
    ) {
      return "border-yellow-400/30 bg-yellow-400/10 text-yellow-400";
    }

    return "border-green-400/30 bg-green-400/10 text-green-400";
  };

  return (
    <section className="mt-6 rounded-3xl border border-white/10 bg-slate-900 p-5 shadow-xl">

      {/* HEADER */}

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-400">
            AI & Analytics
          </p>

          <h2 className="mt-1 text-2xl font-black text-white">
            Risk Intelligence
          </h2>

          <p className="mt-1 text-sm leading-6 text-slate-400">
            Analyze compliance and violation patterns to identify emerging mine risks.
          </p>
        </div>

        <div
          className={`rounded-2xl border px-5 py-4 text-center ${getRiskClass()}`}
        >
          <p className="text-xs font-bold uppercase tracking-widest">
            Current Risk
          </p>

          <p className="mt-1 text-2xl font-black">
            {riskLevel}
          </p>
        </div>

      </div>

      {/* RISK SCORE */}

      <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5">

        <div className="flex items-center justify-between">

          <div>

            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
              Risk Score
            </p>

            <p className="mt-1 text-4xl font-black text-white">
              {riskScore}
              <span className="text-lg text-slate-500">
                /100
              </span>
            </p>

          </div>

          <div className="text-right">

            <p className="text-xs text-slate-500">
              0 = Lowest
            </p>

            <p className="text-xs font-bold text-red-400">
              100 = Highest
            </p>

          </div>

        </div>

        <div className="mt-5 h-4 overflow-hidden rounded-full bg-slate-800">

          <div
            className={`h-full transition-all duration-500 ${
              riskScore >= 75
                ? "bg-red-500"
                : riskScore >= 50
                ? "bg-orange-500"
                : riskScore >= 25
                ? "bg-yellow-400"
                : "bg-green-400"
            }`}
            style={{
              width:
                `${riskScore}%`,
            }}
          />

        </div>

      </div>

      {/* METRICS */}

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">

        <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4">

          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
            Compliance
          </p>

          <p className="mt-2 text-2xl font-black text-cyan-400">
            {complianceScore}%
          </p>

        </div>

        <div className="rounded-2xl border border-red-400/20 bg-red-400/5 p-4">

          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
            Open Violations
          </p>

          <p className="mt-2 text-2xl font-black text-red-400">
            {openViolations}
          </p>

        </div>

        <div className="rounded-2xl border border-orange-400/20 bg-orange-400/5 p-4">

          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
            Critical
          </p>

          <p className="mt-2 text-2xl font-black text-orange-400">
            {criticalViolations}
          </p>

        </div>

        <div className="rounded-2xl border border-purple-400/20 bg-purple-400/5 p-4">

          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
            Overdue
          </p>

          <p className="mt-2 text-2xl font-black text-purple-400">
            {overdueActions}
          </p>

        </div>

      </div>

      {/* =====================================
          LIVE BACKEND METRICS
      ===================================== */}

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">

        <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4">

          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
            Live Inspections
          </p>

          <p className="mt-2 text-2xl font-black text-cyan-400">
            {backendInspections.length}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Records from CoalGuard API
          </p>

        </div>

        <div className="rounded-2xl border border-red-400/20 bg-red-400/5 p-4">

          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
            Backend RED Risk
          </p>

          <p className="mt-2 text-2xl font-black text-red-400">
            {highRiskInspections.length}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            High-risk field inspections
          </p>

        </div>

        <div className="rounded-2xl border border-violet-400/20 bg-violet-400/5 p-4">

          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
            Backend Feed
          </p>

          <p className="mt-2 text-sm font-black text-violet-400">
            {backendInspectionsLoading
              ? "UPDATING"
              : backendInspectionsError
              ? "OFFLINE"
              : "LIVE"}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Refreshes every 2 seconds
          </p>

        </div>

      </div>

      {backendInspectionsError && (
        <div className="mt-3 rounded-xl border border-yellow-800/60 bg-yellow-950/20 p-3 text-xs text-yellow-400">
          Backend inspection feed unavailable: {backendInspectionsError}
        </div>
      )}

      {/* =====================================
          LIVE FIELD RISK FEED
      ===================================== */}

      <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">

        <div className="flex items-center justify-between gap-3">

          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-violet-400">
              Live Field Risk Feed
            </p>

            <p className="mt-1 text-sm text-slate-400">
              Latest risk classifications generated by the backend inspection engine.
            </p>
          </div>

          <span className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-bold text-slate-400">
            {backendInspections.length} RECORDS
          </span>

        </div>

        {backendInspections.length === 0 ? (

          <div className="mt-4 rounded-xl border border-dashed border-slate-700 p-5 text-center">
            <p className="text-sm text-slate-500">
              No backend inspection records available yet.
            </p>
          </div>

        ) : (

          <div className="mt-4 space-y-2">

            {backendInspections.slice(0, 6).map((inspection) => {

              const isRed =
                String(inspection.risk_level).toUpperCase() === "RED";

              return (
                <div
                  key={inspection.id}
                  className="flex flex-col gap-3 rounded-xl bg-slate-950 p-4 md:flex-row md:items-center md:justify-between"
                >

                  <div>

                    <p className="text-sm font-bold text-white">
                      Inspection #{inspection.id}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {inspection.location_name} •{" "}
                      {inspection.inspector_name}
                    </p>

                  </div>

                  <div className="flex items-center gap-3">

                    <span
                      className={
                        isRed
                          ? "rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-black text-red-400"
                          : "rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs font-black text-green-400"
                      }
                    >
                      {String(inspection.risk_level).toUpperCase()}
                    </span>

                    <span className="text-xs text-slate-600">
                      {Number(inspection.distance_meters).toFixed(1)} m
                    </span>

                  </div>

                </div>
              );
            })}

          </div>

        )}

      </div>

      {/* PATTERN DETECTION */}

      <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">

        <p className="text-xs font-bold uppercase tracking-widest text-violet-400">
          Pattern Detection
        </p>

        <div className="mt-3 flex items-center justify-between rounded-xl bg-violet-400/5 p-4">

          <div>

            <p className="text-sm font-bold text-slate-300">
              Repeated violation category
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Detects categories with multiple unresolved violations.
            </p>

          </div>

          <span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-2 text-xs font-black text-violet-400">
            {repeatedCategory}
          </span>

        </div>

      </div>

      {/* RISK FACTORS */}

      <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">

        <p className="text-xs font-bold uppercase tracking-widest text-red-400">
          Detected Risk Factors
        </p>

        <div className="mt-3 space-y-2">

          {riskFactors.map(
            (factor, index) => (
              <div
                key={index}
                className="flex gap-3 rounded-xl bg-red-400/5 p-3"
              >

                <span className="text-red-400">
                  ⚠
                </span>

                <p className="text-sm leading-6 text-slate-300">
                  {factor}
                </p>

              </div>
            )
          )}

        </div>

      </div>

      {/* RECOMMENDATIONS */}

      <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">

        <p className="text-xs font-bold uppercase tracking-widest text-green-400">
          Recommended Actions
        </p>

        <div className="mt-3 space-y-2">

          {recommendations.map(
            (
              recommendation,
              index
            ) => (
              <div
                key={index}
                className="flex gap-3 rounded-xl bg-green-400/5 p-3"
              >

                <span className="text-green-400">
                  ✓
                </span>

                <p className="text-sm leading-6 text-slate-300">
                  {recommendation}
                </p>

              </div>
            )
          )}

        </div>

      </div>

      {/* ENGINE INFORMATION */}

      <div className="mt-4 rounded-2xl border border-violet-400/20 bg-violet-400/5 p-4">

        <p className="text-xs font-bold uppercase tracking-widest text-violet-400">
          Risk Intelligence Engine
        </p>

        <p className="mt-2 text-sm leading-6 text-slate-400">
          The prototype analyzes compliance failures,
          unresolved violations, severity, overdue corrective
          actions, pending assessments and recurring violation
          categories to calculate a dynamic risk score.
        </p>

        <p className="mt-2 text-xs text-slate-500">
          Current implementation: rule-based analytics.
          Architecture is prepared for future ML integration.
        </p>

      </div>

    </section>
  );
}

export default RiskIntelligence;