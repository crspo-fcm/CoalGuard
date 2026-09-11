import { useEffect, useState } from "react";

import {
  getBackendInspections,
  type BackendInspection,
} from "../services/coalguardApi";

type ComplianceItem = {
  id: number;
  title: string;
  status: "Compliant" | "Non-Compliant" | "Pending";
};

type ComplianceCategory = {
  name: string;
  icon: string;
  items: ComplianceItem[];
};

type Violation = {
  id: number;
  title: string;
  category: string;
  severity: string;
  status: string;
  assignedTo: string;
  dueDate: string;
};

type ManagerAlert = {
  id: string;
  title: string;
  category: string;
  recipient: string;
  reportedAt: string;
  deadline: string;
  status: string;
};

type BackendViolationResponse = {
  id?: number;
  title?: string;
  category?: string;
  severity?: string;
  status?: string;
  assigned_to?: string;
  due_date?: string;
};

function normalizeStatus(value: string) {
  return String(value || "").trim().toLowerCase();
}

function ComplianceReports() {
  const [categories, setCategories] = useState<
    ComplianceCategory[]
  >([]);

  const [violations, setViolations] = useState<
    Violation[]
  >([]);

  const [alerts, setAlerts] = useState<
    ManagerAlert[]
  >([]);

  const [backendInspections, setBackendInspections] =
    useState<BackendInspection[]>([]);

  const [backendLoading, setBackendLoading] =
    useState(true);

  const [backendError, setBackendError] =
    useState<string | null>(null);

  const [violationsLoading, setViolationsLoading] =
    useState(true);

  const [violationsError, setViolationsError] =
    useState<string | null>(null);

  const [reportGenerated, setReportGenerated] =
    useState(false);

  /*
  =========================================================
  LOAD LOCAL COMPLIANCE / ESCALATION DATA
  =========================================================
  */

  const loadLocalData = () => {
    const complianceData =
      localStorage.getItem(
        "coalguard_compliance"
      );

    const alertData =
      localStorage.getItem(
        "coalguard_manager_alerts"
      );

    if (complianceData) {
      try {
        const parsed = JSON.parse(
          complianceData
        );

        setCategories(
          Array.isArray(parsed)
            ? parsed
            : []
        );
      } catch {
        setCategories([]);
      }
    } else {
      setCategories([]);
    }

    if (alertData) {
      try {
        const parsed = JSON.parse(
          alertData
        );

        setAlerts(
          Array.isArray(parsed)
            ? parsed
            : []
        );
      } catch {
        setAlerts([]);
      }
    } else {
      setAlerts([]);
    }
  };

  /*
  =========================================================
  LOAD REAL VIOLATIONS FROM SQLITE BACKEND
  =========================================================
  */

  const loadBackendViolations =
    async () => {
      try {
        setViolationsError(null);
        setViolationsLoading(true);

        const response = await fetch(
          "/api/violations"
        );

        const data =
          await response
            .json()
            .catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            data.message ||
              "Failed to load backend violations."
          );
        }

        const backendViolations =
          Array.isArray(
            data.violations
          )
            ? data.violations
            : [];

        const formattedViolations: Violation[] =
          backendViolations.map(
            (
              item: BackendViolationResponse
            ) => ({
              id: Number(item.id || 0),

              title:
                item.title ||
                "Violation",

              category:
                item.category ||
                "General Safety",

              severity:
                item.severity ||
                "Moderate",

              status:
                item.status ||
                "Reported",

              assignedTo:
                item.assigned_to ||
                "",

              dueDate:
                item.due_date ||
                "",
            })
          );

        setViolations(
          formattedViolations
        );
      } catch (error) {
        console.error(
          "Compliance Reports violation backend error:",
          error
        );

        setViolations([]);

        setViolationsError(
          error instanceof Error
            ? error.message
            : "Failed to load backend violations."
        );
      } finally {
        setViolationsLoading(false);
      }
    };

  /*
  =========================================================
  LOAD REAL INSPECTIONS FROM SQLITE BACKEND
  =========================================================
  */

  const loadBackendInspections =
    async () => {
      try {
        setBackendError(null);

        const inspections =
          await getBackendInspections();

        setBackendInspections(
          inspections
        );
      } catch (error) {
        console.error(
          "Compliance Reports inspection backend error:",
          error
        );

        setBackendError(
          error instanceof Error
            ? error.message
            : "Failed to load backend inspections."
        );
      } finally {
        setBackendLoading(false);
      }
    };

  /*
  =========================================================
  INITIAL LOAD + LIVE REFRESH
  =========================================================
  */

  useEffect(() => {
    loadLocalData();

    void loadBackendInspections();

    void loadBackendViolations();

    const timer =
      window.setInterval(() => {
        loadLocalData();

        void loadBackendInspections();

        void loadBackendViolations();
      }, 3000);

    return () =>
      window.clearInterval(timer);
  }, []);

  /*
  =========================================================
  COMPLIANCE CALCULATIONS
  =========================================================
  */

  const allItems =
    categories.flatMap(
      (category) =>
        category.items
    );

  const assessed =
    allItems.filter(
      (item) =>
        item.status !== "Pending"
    );

  const compliant =
    allItems.filter(
      (item) =>
        item.status ===
        "Compliant"
    );

  const nonCompliant =
    allItems.filter(
      (item) =>
        item.status ===
        "Non-Compliant"
    );

  const pending =
    allItems.filter(
      (item) =>
        item.status ===
        "Pending"
    );

  const complianceScore =
    assessed.length === 0
      ? 0
      : Math.round(
          (compliant.length /
            assessed.length) *
            100
        );

  /*
  =========================================================
  INSPECTION RISK CALCULATIONS
  =========================================================
  */

  const redInspections =
    backendInspections.filter(
      (inspection) =>
        String(
          inspection.risk_level || ""
        ).toUpperCase() === "RED"
    ).length;

  const greenInspections =
    backendInspections.filter(
      (inspection) =>
        String(
          inspection.risk_level || ""
        ).toUpperCase() ===
        "GREEN"
    ).length;

  const openBackendInspections =
    backendInspections.filter(
      (inspection) =>
        normalizeStatus(
          inspection.status
        ) !== "resolved"
    ).length;

  const backendRiskScore =
    backendInspections.length === 0
      ? 0
      : Math.round(
          (redInspections /
            backendInspections.length) *
            100
        );

  /*
  =========================================================
  BACKEND VIOLATION CALCULATIONS
  =========================================================
  */

  const openViolations =
    violations.filter(
      (item) =>
        normalizeStatus(
          item.status
        ) !== "resolved"
    );

  const criticalViolations =
    openViolations.filter(
      (item) =>
        normalizeStatus(
          item.severity
        ) === "critical"
    );

  const highViolations =
    openViolations.filter(
      (item) =>
        normalizeStatus(
          item.severity
        ) === "high"
    );

  /*
  =========================================================
  LOCAL ALERT CALCULATIONS
  =========================================================
  */

  const openAlerts =
    alerts.filter(
      (item) =>
        normalizeStatus(
          item.status
        ) !== "resolved"
    );

  const overdueAlerts =
    openAlerts.filter(
      (item) => {
        if (!item.deadline) {
          return false;
        }

        const deadline =
          new Date(
            item.deadline
          ).getTime();

        return (
          !Number.isNaN(
            deadline
          ) &&
          deadline < Date.now()
        );
      }
    );

  /*
  =========================================================
  COMBINED MANAGEMENT ALERT COUNT
  =========================================================
  */

  const backendManagementAlerts =
    openViolations.filter(
      (item) => {
        const severity =
          normalizeStatus(
            item.severity
          );

        return (
          severity ===
            "critical" ||
          severity === "high"
        );
      }
    );

  const totalManagementAlerts =
    backendManagementAlerts.length +
    openAlerts.length;

  /*
  =========================================================
  CATEGORY SCORE
  =========================================================
  */

  const getCategoryScore = (
    category: ComplianceCategory
  ) => {
    const assessedItems =
      category.items.filter(
        (item) =>
          item.status !==
          "Pending"
      );

    if (
      assessedItems.length === 0
    ) {
      return 0;
    }

    const compliantItems =
      assessedItems.filter(
        (item) =>
          item.status ===
          "Compliant"
      );

    return Math.round(
      (compliantItems.length /
        assessedItems.length) *
        100
    );
  };

  /*
  =========================================================
  REPORT GENERATION
  =========================================================
  */

  const generateReport = () => {
    setReportGenerated(true);

    window.setTimeout(() => {
      window.print();
    }, 300);
  };

  return (
    <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between print:hidden">

        <div>

          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Governance & Reporting
          </p>

          <h2 className="mt-2 text-2xl font-bold">
            Automated Compliance Reports
          </h2>

          <p className="mt-2 text-sm text-slate-400">
            Generate a management-ready
            compliance report from current
            CoalGuard data.
          </p>

        </div>

        <button
          onClick={generateReport}
          className="rounded-xl border border-slate-600 bg-slate-800 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
        >
          📄 Generate Report
        </button>

      </div>

      {/* =================================================
          REPORT
      ================================================= */}

      <div
        id="coalguard-report"
        className="mt-6 rounded-2xl border border-slate-800 bg-slate-950 p-6"
      >

        {/* =================================================
            REPORT HEADER
        ================================================= */}

        <div className="border-b border-slate-800 pb-5">

          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">

            <div>

              <p className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500">
                COALGUARD
              </p>

              <h3 className="mt-2 text-2xl font-bold">
                Mine Compliance Report
              </h3>

              <p className="mt-2 text-sm text-slate-400">
                Smart Mine Governance &
                Compliance Monitoring
              </p>

            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">

              <p className="text-xs text-slate-500">
                Report Generated
              </p>

              <p className="mt-1 text-sm font-semibold">
                {new Date().toLocaleString()}
              </p>

            </div>

          </div>

        </div>

        {/* =================================================
            LIVE BACKEND INSPECTION SUMMARY
        ================================================= */}

        <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900 p-5">

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

            <div>

              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Live Backend Inspection Summary
              </p>

              <p className="mt-1 text-sm text-slate-400">
                Real inspection and risk data
                from the CoalGuard SQLite backend.
              </p>

            </div>

            <span
              className={`text-xs font-semibold ${
                backendError
                  ? "text-red-400"
                  : backendLoading
                    ? "text-yellow-400"
                    : "text-green-400"
              }`}
            >
              {backendError
                ? "API ERROR"
                : backendLoading
                  ? "CONNECTING..."
                  : "API LINKED"}
            </span>

          </div>

          {backendError && (
            <div className="mt-4 rounded-lg border border-red-800 bg-red-950/30 p-3 text-xs text-red-400">
              {backendError}
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">

              <p className="text-xs text-slate-500">
                Total Inspections
              </p>

              <p className="mt-2 text-2xl font-bold text-white">
                {backendInspections.length}
              </p>

            </div>

            <div className="rounded-xl border border-green-900/60 bg-green-950/20 p-4">

              <p className="text-xs text-green-400">
                GREEN Risk
              </p>

              <p className="mt-2 text-2xl font-bold text-green-400">
                {greenInspections}
              </p>

            </div>

            <div className="rounded-xl border border-red-900/60 bg-red-950/20 p-4">

              <p className="text-xs text-red-400">
                RED Risk
              </p>

              <p className="mt-2 text-2xl font-bold text-red-400">
                {redInspections}
              </p>

            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">

              <p className="text-xs text-slate-500">
                Risk Exposure
              </p>

              <p className="mt-2 text-2xl font-bold text-orange-400">
                {backendRiskScore}%
              </p>

            </div>

          </div>

        </div>

        {/* =================================================
            EXECUTIVE SUMMARY
        ================================================= */}

        <div className="mt-6">

          <h4 className="text-sm font-bold uppercase tracking-wider text-slate-400">
            Executive Summary
          </h4>

          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">

              <p className="text-xs text-slate-500">
                Compliance
              </p>

              <p className="mt-2 text-2xl font-bold">
                {complianceScore}%
              </p>

            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">

              <p className="text-xs text-slate-500">
                Assessed
              </p>

              <p className="mt-2 text-2xl font-bold">
                {assessed.length}
              </p>

            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">

              <p className="text-xs text-slate-500">
                Non-Compliant
              </p>

              <p className="mt-2 text-2xl font-bold text-red-400">
                {nonCompliant.length}
              </p>

            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">

              <p className="text-xs text-slate-500">
                Pending
              </p>

              <p className="mt-2 text-2xl font-bold text-yellow-400">
                {pending.length}
              </p>

            </div>

          </div>

        </div>

        {/* =================================================
            COMPLIANCE BY CATEGORY
        ================================================= */}

        <div className="mt-8">

          <h4 className="text-sm font-bold uppercase tracking-wider text-slate-400">
            Compliance by Regulatory Category
          </h4>

          <div className="mt-4 overflow-x-auto">

            {categories.length === 0 ? (

              <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-center">

                <p className="text-sm text-slate-500">
                  No compliance category records
                  are currently configured.
                </p>

              </div>

            ) : (

              <table className="w-full min-w-[600px] text-left">

                <thead>

                  <tr className="border-b border-slate-800">

                    <th className="px-4 py-3 text-xs uppercase tracking-wider text-slate-500">
                      Category
                    </th>

                    <th className="px-4 py-3 text-xs uppercase tracking-wider text-slate-500">
                      Assessed
                    </th>

                    <th className="px-4 py-3 text-xs uppercase tracking-wider text-slate-500">
                      Compliant
                    </th>

                    <th className="px-4 py-3 text-xs uppercase tracking-wider text-slate-500">
                      Non-Compliant
                    </th>

                    <th className="px-4 py-3 text-xs uppercase tracking-wider text-slate-500">
                      Score
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {categories.map(
                    (category) => {

                      const categoryAssessed =
                        category.items.filter(
                          (item) =>
                            item.status !==
                            "Pending"
                        );

                      const categoryCompliant =
                        category.items.filter(
                          (item) =>
                            item.status ===
                            "Compliant"
                        );

                      const categoryFailed =
                        category.items.filter(
                          (item) =>
                            item.status ===
                            "Non-Compliant"
                        );

                      return (

                        <tr
                          key={
                            category.name
                          }
                          className="border-b border-slate-800"
                        >

                          <td className="px-4 py-4 text-sm font-semibold">

                            {category.icon}{" "}

                            {category.name}

                          </td>

                          <td className="px-4 py-4 text-sm text-slate-400">
                            {categoryAssessed.length}
                          </td>

                          <td className="px-4 py-4 text-sm text-green-400">
                            {categoryCompliant.length}
                          </td>

                          <td className="px-4 py-4 text-sm text-red-400">
                            {categoryFailed.length}
                          </td>

                          <td className="px-4 py-4">

                            <span className="font-bold">
                              {getCategoryScore(
                                category
                              )}
                              %
                            </span>

                          </td>

                        </tr>

                      );
                    }
                  )}

                </tbody>

              </table>

            )}

          </div>

        </div>

        {/* =================================================
            LIVE FIELD INSPECTIONS
        ================================================= */}

        <div className="mt-8">

          <div className="flex items-center justify-between">

            <h4 className="text-sm font-bold uppercase tracking-wider text-slate-400">
              Recent Field Inspections
            </h4>

            <span className="text-xs text-slate-500">
              {openBackendInspections} Open
            </span>

          </div>

          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-800">

            {backendInspections.length ===
            0 ? (

              <div className="p-8 text-center">

                <p className="text-sm text-slate-500">

                  {backendLoading
                    ? "Loading backend inspections..."
                    : "No backend inspections available."}

                </p>

              </div>

            ) : (

              <table className="w-full min-w-[850px] text-left">

                <thead className="bg-slate-950">

                  <tr className="border-b border-slate-800">

                    <th className="px-4 py-3 text-xs uppercase tracking-wider text-slate-500">
                      Inspection
                    </th>

                    <th className="px-4 py-3 text-xs uppercase tracking-wider text-slate-500">
                      Inspector
                    </th>

                    <th className="px-4 py-3 text-xs uppercase tracking-wider text-slate-500">
                      Mine
                    </th>

                    <th className="px-4 py-3 text-xs uppercase tracking-wider text-slate-500">
                      Risk
                    </th>

                    <th className="px-4 py-3 text-xs uppercase tracking-wider text-slate-500">
                      GPS
                    </th>

                    <th className="px-4 py-3 text-xs uppercase tracking-wider text-slate-500">
                      Status
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {backendInspections
                    .slice(0, 10)
                    .map(
                      (inspection) => {

                        const isRed =
                          String(
                            inspection.risk_level ||
                              ""
                          ).toUpperCase() ===
                          "RED";

                        return (

                          <tr
                            key={
                              inspection.id
                            }
                            className="border-b border-slate-800"
                          >

                            <td className="px-4 py-4 font-mono text-xs text-slate-300">
                              #{inspection.id}
                            </td>

                            <td className="px-4 py-4 text-xs text-slate-300">
                              {inspection.inspector_name ||
                                "Unknown"}
                            </td>

                            <td className="px-4 py-4 text-xs text-slate-300">
                              {inspection.location_name ||
                                "Unknown"}
                            </td>

                            <td className="px-4 py-4">

                              <span
                                className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                                  isRed
                                    ? "bg-red-500/10 text-red-400"
                                    : "bg-green-500/10 text-green-400"
                                }`}
                              >
                                {inspection.risk_level ||
                                  "UNKNOWN"}
                              </span>

                            </td>

                            <td className="px-4 py-4 text-xs text-slate-400">

                              {Number(
                                inspection.distance_meters ||
                                  0
                              ).toFixed(1)}{" "}
                              m

                            </td>

                            <td className="px-4 py-4 text-xs text-slate-400">
                              {inspection.status ||
                                "OPEN"}
                            </td>

                          </tr>

                        );
                      }
                    )}

                </tbody>

              </table>

            )}

          </div>

        </div>

        {/* =================================================
            BACKEND VIOLATION SUMMARY
        ================================================= */}

        <div className="mt-8">

          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">

            <h4 className="text-sm font-bold uppercase tracking-wider text-slate-400">
              Violation Summary
            </h4>

            <span
              className={`text-xs font-semibold ${
                violationsError
                  ? "text-red-400"
                  : violationsLoading
                    ? "text-yellow-400"
                    : "text-green-400"
              }`}
            >
              {violationsError
                ? "VIOLATION API ERROR"
                : violationsLoading
                  ? "LOADING..."
                  : "SQLITE BACKEND"}
            </span>

          </div>

          {violationsError && (

            <div className="mt-3 rounded-lg border border-red-800 bg-red-950/30 p-3 text-xs text-red-400">
              {violationsError}
            </div>

          )}

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">

            {/* TOTAL */}

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">

              <p className="text-xs text-slate-500">
                Total Violations
              </p>

              <p className="mt-2 text-2xl font-bold text-white">
                {violations.length}
              </p>

            </div>

            {/* OPEN */}

            <div className="rounded-xl border border-red-900/50 bg-red-950/20 p-4">

              <p className="text-xs text-slate-500">
                Open Violations
              </p>

              <p className="mt-2 text-2xl font-bold text-red-400">
                {openViolations.length}
              </p>

            </div>

            {/* HIGH */}

            <div className="rounded-xl border border-orange-900/50 bg-orange-950/20 p-4">

              <p className="text-xs text-slate-500">
                High Violations
              </p>

              <p className="mt-2 text-2xl font-bold text-orange-400">
                {highViolations.length}
              </p>

            </div>

            {/* CRITICAL */}

            <div className="rounded-xl border border-red-900/70 bg-red-950/30 p-4">

              <p className="text-xs text-slate-500">
                Critical Violations
              </p>

              <p className="mt-2 text-2xl font-bold text-red-400">
                {criticalViolations.length}
              </p>

            </div>

          </div>

          {/* VIOLATION TABLE */}

          {violations.length > 0 && (

            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-800">

              <table className="w-full min-w-[800px] text-left">

                <thead className="bg-slate-950">

                  <tr className="border-b border-slate-800">

                    <th className="px-4 py-3 text-xs uppercase tracking-wider text-slate-500">
                      ID
                    </th>

                    <th className="px-4 py-3 text-xs uppercase tracking-wider text-slate-500">
                      Violation
                    </th>

                    <th className="px-4 py-3 text-xs uppercase tracking-wider text-slate-500">
                      Category
                    </th>

                    <th className="px-4 py-3 text-xs uppercase tracking-wider text-slate-500">
                      Severity
                    </th>

                    <th className="px-4 py-3 text-xs uppercase tracking-wider text-slate-500">
                      Status
                    </th>

                    <th className="px-4 py-3 text-xs uppercase tracking-wider text-slate-500">
                      Assigned To
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {violations
                    .slice(0, 10)
                    .map(
                      (violation) => {

                        const severity =
                          normalizeStatus(
                            violation.severity
                          );

                        const status =
                          normalizeStatus(
                            violation.status
                          );

                        return (

                          <tr
                            key={
                              violation.id
                            }
                            className="border-b border-slate-800"
                          >

                            <td className="px-4 py-4 font-mono text-xs text-slate-300">
                              #{violation.id}
                            </td>

                            <td className="px-4 py-4 text-sm text-slate-300">
                              {violation.title}
                            </td>

                            <td className="px-4 py-4 text-xs text-slate-400">
                              {violation.category}
                            </td>

                            <td className="px-4 py-4">

                              <span
                                className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                                  severity ===
                                  "critical"
                                    ? "bg-red-500/10 text-red-400"
                                    : severity ===
                                        "high"
                                      ? "bg-orange-500/10 text-orange-400"
                                      : "bg-yellow-500/10 text-yellow-400"
                                }`}
                              >
                                {violation.severity}
                              </span>

                            </td>

                            <td className="px-4 py-4">

                              <span
                                className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                                  status ===
                                  "resolved"
                                    ? "bg-green-500/10 text-green-400"
                                    : "bg-red-500/10 text-red-400"
                                }`}
                              >
                                {violation.status}
                              </span>

                            </td>

                            <td className="px-4 py-4 text-xs text-slate-400">
                              {violation.assignedTo ||
                                "Unassigned"}
                            </td>

                          </tr>

                        );
                      }
                    )}

                </tbody>

              </table>

            </div>

          )}

        </div>

        {/* =================================================
            ALERT SUMMARY
        ================================================= */}

        <div className="mt-8">

          <h4 className="text-sm font-bold uppercase tracking-wider text-slate-400">
            Alert & Escalation Summary
          </h4>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">

              <p className="text-xs text-slate-500">
                Backend Alerts
              </p>

              <p className="mt-2 text-2xl font-bold text-yellow-400">
                {backendManagementAlerts.length}
              </p>

            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">

              <p className="text-xs text-slate-500">
                Active Alerts
              </p>

              <p className="mt-2 text-2xl font-bold text-yellow-400">
                {totalManagementAlerts}
              </p>

            </div>

            <div className="rounded-xl border border-red-900/50 bg-red-950/20 p-4">

              <p className="text-xs text-slate-500">
                Overdue Alerts
              </p>

              <p className="mt-2 text-2xl font-bold text-red-400">
                {overdueAlerts.length}
              </p>

            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">

              <p className="text-xs text-slate-500">
                Report Status
              </p>

              <p className="mt-2 text-sm font-bold text-green-400">
                {reportGenerated
                  ? "GENERATED"
                  : "READY"}
              </p>

            </div>

          </div>

        </div>

        {/* =================================================
            MANAGEMENT RECOMMENDATION
        ================================================= */}

        <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-5">

          <h4 className="text-sm font-bold uppercase tracking-wider text-slate-400">
            Management Attention
          </h4>

          {complianceScore < 75 ||
          criticalViolations.length > 0 ||
          highViolations.length > 0 ||
          overdueAlerts.length > 0 ? (

            <div>

              <p className="mt-3 text-sm leading-6 text-slate-300">
                Immediate management review is
                recommended due to identified
                compliance gaps, active violations
                or escalation items.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">

                {highViolations.length >
                  0 && (

                  <span className="rounded-full bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-400">
                    {highViolations.length} High
                    Violation
                    {highViolations.length !==
                    1
                      ? "s"
                      : ""}
                  </span>

                )}

                {criticalViolations.length >
                  0 && (

                  <span className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-400">
                    {criticalViolations.length} Critical
                    Violation
                    {criticalViolations.length !==
                    1
                      ? "s"
                      : ""}
                  </span>

                )}

                {redInspections > 0 && (

                  <span className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-400">
                    {redInspections} Red-Risk
                    Inspection
                    {redInspections !==
                    1
                      ? "s"
                      : ""}
                  </span>

                )}

              </div>

            </div>

          ) : (

            <p className="mt-3 text-sm leading-6 text-slate-300">
              Current compliance indicators are
              within the monitored threshold.
              Continue routine inspections and
              corrective-action tracking.
            </p>

          )}

        </div>

        {/* =================================================
            REPORT FOOTER
        ================================================= */}

        <div className="mt-8 border-t border-slate-800 pt-5">

          <p className="text-xs leading-5 text-slate-600">
            CoalGuard automated compliance
            report. This report is generated
            from the application's current
            inspection, compliance, violation
            and escalation records.
          </p>

        </div>

      </div>

      {/* =================================================
          PRINT BUTTON
      ================================================= */}

      <div className="mt-4 print:hidden">

        <button
          onClick={() =>
            window.print()
          }
          className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-slate-800"
        >
          🖨 Print / Save Report
        </button>

      </div>

    </section>
  );
}

export default ComplianceReports;