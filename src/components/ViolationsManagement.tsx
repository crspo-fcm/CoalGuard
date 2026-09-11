import { useEffect, useMemo, useState } from "react";
import {
  deleteFraudAlert,
  getFraudAlerts,
  type BackendFraudAlert,
} from "../services/coalguardApi";
import { API_BASE_URL } from "../api";

type BackendViolation = {
  id: number;
  inspection_id: number | null;
  title: string;
  description: string | null;
  category: string;
  severity: string;
  reported_by: string | null;
  assigned_to: string | null;
  corrective_action: string | null;
  due_date: string | null;
  status: string;
  resolution_note: string | null;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
  inspection_observation?: string | null;
  inspector_name?: string | null;
  location_name?: string | null;
};

function normalize(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function severityRank(value: unknown) {
  const s = normalize(value);

  if (s === "critical") return 4;
  if (s === "high") return 3;
  if (s === "medium" || s === "moderate") return 2;
  if (s === "low") return 1;

  return 0;
}

function severityLabel(
  value: unknown
): "Critical" | "High" | "Moderate" {
  const rank = severityRank(value);

  if (rank === 4) return "Critical";
  if (rank === 3) return "High";

  return "Moderate";
}

function severityClass(value: unknown) {
  const label = severityLabel(value);

  if (label === "Critical") {
    return "bg-red-500/10 text-red-400";
  }

  if (label === "High") {
    return "bg-orange-500/10 text-orange-400";
  }

  return "bg-yellow-500/10 text-yellow-400";
}

function isResolved(status: unknown) {
  return normalize(status) === "resolved";
}

function getTimeText(createdAt: string) {
  if (!createdAt) return "Unknown";

  const timestamp = new Date(createdAt).getTime();

  if (Number.isNaN(timestamp)) {
    return "Unknown";
  }

  const minutes = Math.max(
    0,
    Math.floor(
      (Date.now() - timestamp) / 60000
    )
  );

  if (minutes < 1) return "Just now";

  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours} hr ago`;
  }

  return `${Math.floor(hours / 24)} day(s) ago`;
}

function formatDate(
  value: string | null | undefined
) {
  if (!value) return "Not set";

  const d = new Date(value);

  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString("en-IN");
}

const STATUS_OPTIONS = [
  "Reported",
  "In Progress",
  "Awaiting Verification",
  "Resolved",
];

function AlertsCenter() {
  const [
    violations,
    setViolations,
  ] = useState<BackendViolation[]>([]);

  const [
    fraudAlerts,
    setFraudAlerts,
  ] = useState<BackendFraudAlert[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [
    backendError,
    setBackendError,
  ] = useState("");

  const [
    lastUpdated,
    setLastUpdated,
  ] = useState("");

  const [
    filter,
    setFilter,
  ] = useState<
    "All" | "Open" | "Resolved"
  >("All");

  const [
    severityFilter,
    setSeverityFilter,
  ] = useState<
    "All" | "Critical" | "High" | "Moderate"
  >("All");

  const [
    expandedId,
    setExpandedId,
  ] = useState<number | null>(null);

  const [
    savingId,
    setSavingId,
  ] = useState<number | null>(null);

  const [
    deletingFraudId,
    setDeletingFraudId,
  ] = useState<number | null>(null);

  const [
    editForm,
    setEditForm,
  ] = useState({
    assigned_to: "",
    corrective_action: "",
    due_date: "",
    status: "Reported",
    resolution_note: "",
    verified_by: "",
  });

  /* =========================================================
     LOAD VIOLATIONS FROM LIVE RENDER BACKEND
  ========================================================= */

  const loadViolations =
    async (): Promise<
      BackendViolation[]
    > => {
      const response = await fetch(
        `${API_BASE_URL}/api/violations`
      );

      const data =
        await response.json().catch(
          () => ({})
        );

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Failed to load violations."
        );
      }

      return Array.isArray(
        data.violations
      )
        ? data.violations
        : [];
    };

  /* =========================================================
     LOAD ALL DATA
  ========================================================= */

  const loadData = async (
    showLoading = false
  ) => {
    try {
      if (showLoading) {
        setLoading(true);
      }

      const [
        nextViolations,
        nextFraudAlerts,
      ] = await Promise.all([
        loadViolations(),
        getFraudAlerts(),
      ]);

      setViolations(
        nextViolations
      );

      setFraudAlerts(
        nextFraudAlerts
      );

      setBackendError("");

      setLastUpdated(
        new Date().toLocaleTimeString(
          "en-IN"
        )
      );
    } catch (error) {
      console.error(
        "Violations management backend error:",
        error
      );

      setBackendError(
        error instanceof Error
          ? error.message
          : "Unable to load backend violations."
      );
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  /* =========================================================
     LIVE REFRESH — EVERY 3 SECONDS
  ========================================================= */

  useEffect(() => {
    void loadData(true);

    const timer =
      window.setInterval(() => {
        void loadData(false);
      }, 3000);

    return () =>
      window.clearInterval(timer);
  }, []);

  /* =========================================================
     FILTERING
  ========================================================= */

  const openViolations =
    useMemo(
      () =>
        violations.filter(
          (v) =>
            !isResolved(
              v.status
            )
        ),
      [violations]
    );

  const resolvedViolations =
    useMemo(
      () =>
        violations.filter(
          (v) =>
            isResolved(
              v.status
            )
        ),
      [violations]
    );

  const criticalCount =
    openViolations.filter(
      (v) =>
        severityRank(
          v.severity
        ) === 4
    ).length;

  const highCount =
    openViolations.filter(
      (v) =>
        severityRank(
          v.severity
        ) === 3
    ).length;

  const moderateCount =
    openViolations.filter(
      (v) =>
        severityRank(
          v.severity
        ) <= 2
    ).length;

  const filteredViolations =
    useMemo(() => {
      return violations.filter(
        (v) => {
          const statusMatch =
            filter === "All" ||
            (filter ===
              "Open" &&
              !isResolved(
                v.status
              )) ||
            (filter ===
              "Resolved" &&
              isResolved(
                v.status
              ));

          const severityMatch =
            severityFilter ===
              "All" ||
            severityLabel(
              v.severity
            ) ===
              severityFilter;

          return (
            statusMatch &&
            severityMatch
          );
        }
      );
    }, [
      violations,
      filter,
      severityFilter,
    ]);

  /* =========================================================
     START EDITING
  ========================================================= */

  const startEditing = (
    violation: BackendViolation
  ) => {
    setExpandedId(
      violation.id
    );

    setEditForm({
      assigned_to:
        violation.assigned_to ||
        "",

      corrective_action:
        violation.corrective_action ||
        "",

      due_date:
        violation.due_date
          ? String(
              violation.due_date
            ).slice(0, 10)
          : "",

      status:
        violation.status ||
        "Reported",

      resolution_note:
        violation.resolution_note ||
        "",

      verified_by:
        violation.verified_by ||
        "",
    });
  };

  const updateField = (
    field: keyof typeof editForm,
    value: string
  ) => {
    setEditForm(
      (current) => ({
        ...current,
        [field]: value,
      })
    );
  };

  /* =========================================================
     SAVE VIOLATION
  ========================================================= */

  const saveViolation =
    async (
      violation: BackendViolation
    ) => {
      try {
        setSavingId(
          violation.id
        );

        const payload: Record<
          string,
          string
        > = {
          assigned_to:
            editForm.assigned_to.trim(),

          corrective_action:
            editForm.corrective_action.trim(),

          due_date:
            editForm.due_date,

          status:
            editForm.status,

          resolution_note:
            editForm.resolution_note.trim(),

          verified_by:
            editForm.verified_by.trim(),
        };

        if (
          editForm.status ===
          "Resolved"
        ) {
          if (
            !payload.verified_by
          ) {
            window.alert(
              "Enter Verified By before resolving the violation."
            );

            return;
          }

          payload.verified_at =
            new Date().toISOString();
        } else {
          payload.verified_at =
            violation.verified_at ||
            "";
        }

        const response =
          await fetch(
            `${API_BASE_URL}/api/violations/${violation.id}`,
            {
              method: "PATCH",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify(
                payload
              ),
            }
          );

        const data =
          await response
            .json()
            .catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            data.message ||
              "Failed to update violation."
          );
        }

        if (
          data.violation
        ) {
          setViolations(
            (current) =>
              current.map(
                (item) =>
                  item.id ===
                  violation.id
                    ? data.violation
                    : item
              )
          );
        } else {
          await loadData(false);
        }

        window.alert(
          `Violation #${violation.id} updated successfully.`
        );

        setExpandedId(null);
      } catch (error) {
        window.alert(
          error instanceof Error
            ? error.message
            : "Failed to update violation."
        );
      } finally {
        setSavingId(null);
      }
    };

  /* =========================================================
     MOVE TO NEXT WORKFLOW STAGE
  ========================================================= */

  const moveToNextStage =
    async (
      violation: BackendViolation
    ) => {
      const current =
        normalize(
          violation.status
        );

      let next = "Reported";

      if (
        current ===
        "reported"
      ) {
        next = "In Progress";
      } else if (
        current ===
        "in progress"
      ) {
        next =
          "Awaiting Verification";
      } else if (
        current ===
        "awaiting verification"
      ) {
        next = "Resolved";
      } else {
        return;
      }

      if (
        next === "Resolved"
      ) {
        startEditing({
          ...violation,
          status: "Resolved",
        });

        setEditForm(
          (currentForm) => ({
            ...currentForm,
            status: "Resolved",
          })
        );

        return;
      }

      try {
        setSavingId(
          violation.id
        );

        const response =
          await fetch(
            `${API_BASE_URL}/api/violations/${violation.id}`,
            {
              method: "PATCH",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify({
                status: next,
              }),
            }
          );

        const data =
          await response
            .json()
            .catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            data.message ||
              "Failed to change status."
          );
        }

        if (
          data.violation
        ) {
          setViolations(
            (currentList) =>
              currentList.map(
                (item) =>
                  item.id ===
                  violation.id
                    ? data.violation
                    : item
              )
          );
        }

        window.alert(
          `Violation #${violation.id} moved to ${next}.`
        );
      } catch (error) {
        window.alert(
          error instanceof Error
            ? error.message
            : "Failed to change status."
        );
      } finally {
        setSavingId(null);
      }
    };

  /* =========================================================
     DELETE FRAUD ALERT
  ========================================================= */

  const handleDeleteFraudAlert =
    async (
      alertId: number
    ) => {
      if (
        !window.confirm(
          `Delete GPS fraud alert #${alertId}? This will permanently remove it from the database.`
        )
      ) {
        return;
      }

      try {
        setDeletingFraudId(
          alertId
        );

        await deleteFraudAlert(
          alertId
        );

        setFraudAlerts(
          (current) =>
            current.filter(
              (a) =>
                a.id !==
                alertId
            )
        );
      } catch (error) {
        window.alert(
          error instanceof Error
            ? error.message
            : "Failed to delete fraud alert."
        );
      } finally {
        setDeletingFraudId(
          null
        );
      }
    };

  const activeAlerts =
    openViolations.length +
    fraudAlerts.length;

  const totalCritical =
    criticalCount +
    fraudAlerts.length;

  return (
    <section className="mt-8 px-4 pb-12">
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500">
          Governance & Escalation
        </p>

        <h2 className="mt-2 text-3xl font-bold text-white">
          Violations Management
        </h2>

        <p className="mt-2 text-sm text-slate-400">
          Review violations, assign corrective actions,
          track resolution and maintain an auditable
          management workflow.
        </p>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-green-400/20 bg-green-400/10 px-3 py-1 text-xs font-bold text-green-400">
          ● SQLITE BACKEND
        </span>

        <span className="rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-xs font-bold text-blue-400">
          LIVE MANAGEMENT FEED
        </span>

        {lastUpdated && (
          <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-bold text-slate-500">
            Updated {lastUpdated}
          </span>
        )}
      </div>

      {backendError && (
        <div className="mb-5 rounded-xl border border-red-800/60 bg-red-950/20 p-4">
          <p className="font-bold text-red-400">
            Backend Error
          </p>

          <p className="mt-1 text-xs text-slate-400">
            {backendError}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <div className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
          <p className="text-xs uppercase tracking-wider text-slate-400">
            Active
          </p>

          <p className="mt-2 text-3xl font-bold text-white">
            {activeAlerts}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Violations + GPS alerts
          </p>
        </div>

        <div className="rounded-2xl border border-red-900/70 bg-red-950/20 p-5">
          <p className="text-xs uppercase tracking-wider text-red-300">
            Critical
          </p>

          <p className="mt-2 text-3xl font-bold text-red-400">
            {totalCritical}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Critical + GPS
          </p>
        </div>

        <div className="rounded-2xl border border-orange-900/70 bg-orange-950/20 p-5">
          <p className="text-xs uppercase tracking-wider text-orange-300">
            High
          </p>

          <p className="mt-2 text-3xl font-bold text-orange-400">
            {highCount}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            High-risk violations
          </p>
        </div>

        <div className="rounded-2xl border border-yellow-900/70 bg-yellow-950/20 p-5">
          <p className="text-xs uppercase tracking-wider text-yellow-300">
            Moderate
          </p>

          <p className="mt-2 text-3xl font-bold text-yellow-400">
            {moderateCount}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Moderate-risk violations
          </p>
        </div>

        <div className="rounded-2xl border border-green-900/70 bg-green-950/20 p-5">
          <p className="text-xs uppercase tracking-wider text-green-300">
            Resolved
          </p>

          <p className="mt-2 text-3xl font-bold text-green-400">
            {resolvedViolations.length}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Closed violations
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-red-800/60 bg-red-950/10 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-400">
              Live Backend Security Feed
            </p>

            <h3 className="mt-1 text-lg font-bold text-white">
              GPS Fraud Alerts
            </h3>

            <p className="mt-1 text-sm text-slate-400">
              Rejected inspection attempts outside
              the registered mine boundary.
            </p>
          </div>

          <span className="rounded-lg border border-red-800/60 bg-red-950/30 px-3 py-2 text-xs font-bold text-red-400">
            {fraudAlerts.length} LIVE ALERTS
          </span>
        </div>

        {fraudAlerts.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-700 bg-slate-950 p-6 text-center">
            <p className="text-sm font-semibold text-green-400">
              ✓ No GPS fraud attempts detected
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {fraudAlerts
              .slice(0, 10)
              .map((fraud) => (
                <div
                  key={fraud.id}
                  className="rounded-xl border border-red-900/50 bg-slate-950 p-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-red-500/10 px-2 py-1 text-xs font-bold text-red-400">
                          CRITICAL
                        </span>

                        <span className="rounded-md border border-red-900/50 px-2 py-1 text-xs text-slate-500">
                          GPS FRAUD #{fraud.id}
                        </span>
                      </div>

                      <p className="mt-2 text-sm font-bold text-white">
                        {fraud.inspector_name ||
                          "Unknown Inspector"}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        {fraud.location_name ||
                          "Unknown Mine"}
                      </p>

                      <p className="mt-2 text-xs leading-5 text-slate-300">
                        {fraud.reason}
                      </p>
                    </div>

                    <div className="text-left md:text-right">
                      <p className="text-lg font-black text-red-400">
                        {Number(
                          fraud.distance_meters
                        ).toFixed(1)}
                        {" "}m
                      </p>

                      <button
                        type="button"
                        onClick={() =>
                          void handleDeleteFraudAlert(
                            fraud.id
                          )
                        }
                        disabled={
                          deletingFraudId ===
                          fraud.id
                        }
                        className="mt-3 rounded-lg border border-red-700 bg-red-950/20 px-4 py-2 text-xs font-semibold text-red-400 hover:bg-red-900/40 disabled:opacity-50"
                      >
                        {deletingFraudId ===
                        fraud.id
                          ? "Deleting..."
                          : "Delete Alert"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="font-semibold text-white">
              Violation Queue
            </h3>

            <p className="mt-1 text-xs text-slate-500">
              Select a violation to perform manager actions.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {(
              [
                "All",
                "Open",
                "Resolved",
              ] as const
            ).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() =>
                  setFilter(item)
                }
                className={
                  filter === item
                    ? "rounded-lg bg-slate-700 px-3 py-2 text-xs font-semibold text-white"
                    : "rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                }
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(
            [
              "All",
              "Critical",
              "High",
              "Moderate",
            ] as const
          ).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() =>
                setSeverityFilter(item)
              }
              className={
                severityFilter === item
                  ? "rounded-lg bg-slate-700 px-3 py-2 text-xs font-semibold text-white"
                  : "rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-500 hover:text-white"
              }
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {loading &&
        violations.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-10 text-center text-sm text-slate-500">
            Loading backend violations...
          </div>
        ) : filteredViolations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900 p-10 text-center">
            <p className="text-3xl">
              ✓
            </p>

            <h3 className="mt-3 font-semibold text-green-400">
              No Violations Found
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              No violations match the selected filters.
            </p>
          </div>
        ) : (
          filteredViolations.map(
            (violation) => {
              const resolved =
                isResolved(
                  violation.status
                );

              const expanded =
                expandedId ===
                violation.id;

              const severity =
                severityLabel(
                  violation.severity
                );

              return (
                <div
                  key={violation.id}
                  className="rounded-2xl border border-slate-800 bg-slate-900 p-6"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-md px-2 py-1 text-xs font-bold ${severityClass(
                            violation.severity
                          )}`}
                        >
                          {severity}
                        </span>

                        <span
                          className={
                            resolved
                              ? "rounded-md bg-green-500/10 px-2 py-1 text-xs font-bold text-green-400"
                              : "rounded-md bg-red-500/10 px-2 py-1 text-xs font-bold text-red-400"
                          }
                        >
                          {violation.status}
                        </span>

                        <span className="text-xs text-slate-600">
                          Violation #{violation.id}
                        </span>
                      </div>

                      <h3 className="mt-3 text-lg font-bold text-white">
                        {violation.title}
                      </h3>

                      <p className="mt-1 text-sm text-slate-400">
                        {violation.category}
                      </p>
                    </div>

                    <div className="text-left lg:text-right">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Backend Event
                      </p>

                      <p className="mt-1 text-sm text-slate-300">
                        {getTimeText(
                          violation.created_at
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl bg-slate-950 p-4">
                      <p className="text-xs text-slate-500">
                        Inspection
                      </p>

                      <p className="mt-1 text-sm font-semibold text-white">
                        {violation.inspection_id
                          ? `#${violation.inspection_id}`
                          : "N/A"}
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-950 p-4">
                      <p className="text-xs text-slate-500">
                        Location
                      </p>

                      <p className="mt-1 text-sm font-semibold text-white">
                        {violation.location_name ||
                          "Unknown Mine"}
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-950 p-4">
                      <p className="text-xs text-slate-500">
                        Assigned To
                      </p>

                      <p className="mt-1 text-sm font-semibold text-white">
                        {violation.assigned_to ||
                          "Unassigned"}
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-950 p-4">
                      <p className="text-xs text-slate-500">
                        Due Date
                      </p>

                      <p className="mt-1 text-sm font-semibold text-white">
                        {formatDate(
                          violation.due_date
                        )}
                      </p>
                    </div>
                  </div>

                  {violation.description && (
                    <div className="mt-4 rounded-xl bg-slate-950 p-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Description
                      </p>

                      <p className="mt-2 text-sm leading-6 text-slate-300">
                        {violation.description}
                      </p>
                    </div>
                  )}

                  {violation.corrective_action && (
                    <div className="mt-3 rounded-xl border border-yellow-900/50 bg-yellow-950/10 p-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-yellow-400">
                        Corrective Action
                      </p>

                      <p className="mt-2 text-sm leading-6 text-slate-300">
                        {violation.corrective_action}
                      </p>
                    </div>
                  )}

                  {violation.resolution_note && (
                    <div className="mt-3 rounded-xl border border-green-900/50 bg-green-950/10 p-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-green-400">
                        Resolution Note
                      </p>

                      <p className="mt-2 text-sm leading-6 text-slate-300">
                        {violation.resolution_note}
                      </p>
                    </div>
                  )}

                  <div className="mt-5 flex flex-wrap gap-3">
                    {!resolved && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            expanded
                              ? setExpandedId(
                                  null
                                )
                              : startEditing(
                                  violation
                                )
                          }
                          className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-500"
                        >
                          {expanded
                            ? "Close Manager Panel"
                            : "Manage Violation"}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            void moveToNextStage(
                              violation
                            )
                          }
                          disabled={
                            savingId ===
                            violation.id
                          }
                          className="rounded-lg border border-slate-600 bg-slate-950 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                        >
                          {savingId ===
                          violation.id
                            ? "Updating..."
                            : normalize(
                                violation.status
                              ) ===
                              "reported"
                            ? "Start Corrective Action"
                            : normalize(
                                violation.status
                              ) ===
                              "in progress"
                            ? "Request Verification"
                            : "Resolve"}
                        </button>
                      </>
                    )}

                    {resolved && (
                      <button
                        type="button"
                        onClick={() =>
                          startEditing(
                            violation
                          )
                        }
                        className="rounded-lg border border-green-800 bg-green-950/20 px-4 py-2 text-xs font-bold text-green-400 hover:bg-green-900/30"
                      >
                        View Resolution
                      </button>
                    )}
                  </div>

                  {expanded && (
                    <div className="mt-5 rounded-2xl border border-blue-900/60 bg-slate-950 p-5">
                      <div className="mb-5">
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-400">
                          Manager Action Panel
                        </p>

                        <h4 className="mt-1 text-lg font-bold text-white">
                          Violation #{violation.id} — Corrective Action
                        </h4>

                        <p className="mt-1 text-xs text-slate-500">
                          Changes are saved to SQLite and recorded
                          in the Audit Ledger by the backend.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <label className="block">
                          <span className="text-xs font-bold text-slate-400">
                            Assigned To
                          </span>

                          <input
                            value={
                              editForm.assigned_to
                            }
                            onChange={(e) =>
                              updateField(
                                "assigned_to",
                                e.target.value
                              )
                            }
                            placeholder="e.g. Safety Officer"
                            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-3 text-sm text-white outline-none focus:border-blue-500"
                          />
                        </label>

                        <label className="block">
                          <span className="text-xs font-bold text-slate-400">
                            Due Date
                          </span>

                          <input
                            type="date"
                            value={
                              editForm.due_date
                            }
                            onChange={(e) =>
                              updateField(
                                "due_date",
                                e.target.value
                              )
                            }
                            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-3 text-sm text-white outline-none focus:border-blue-500"
                          />
                        </label>

                        <label className="block md:col-span-2">
                          <span className="text-xs font-bold text-slate-400">
                            Corrective Action
                          </span>

                          <textarea
                            rows={4}
                            value={
                              editForm.corrective_action
                            }
                            onChange={(e) =>
                              updateField(
                                "corrective_action",
                                e.target.value
                              )
                            }
                            placeholder="Describe the action required to correct the violation..."
                            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-3 text-sm text-white outline-none focus:border-blue-500"
                          />
                        </label>

                        <label className="block">
                          <span className="text-xs font-bold text-slate-400">
                            Status
                          </span>

                          <select
                            value={
                              editForm.status
                            }
                            onChange={(e) =>
                              updateField(
                                "status",
                                e.target.value
                              )
                            }
                            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-3 text-sm text-white outline-none focus:border-blue-500"
                          >
                            {STATUS_OPTIONS.map(
                              (status) => (
                                <option
                                  key={status}
                                  value={status}
                                >
                                  {status}
                                </option>
                              )
                            )}
                          </select>
                        </label>

                        <label className="block">
                          <span className="text-xs font-bold text-slate-400">
                            Verified By
                          </span>

                          <input
                            value={
                              editForm.verified_by
                            }
                            onChange={(e) =>
                              updateField(
                                "verified_by",
                                e.target.value
                              )
                            }
                            placeholder="Manager / verifier name"
                            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-3 text-sm text-white outline-none focus:border-blue-500"
                          />
                        </label>

                        <label className="block md:col-span-2">
                          <span className="text-xs font-bold text-slate-400">
                            Resolution Note
                          </span>

                          <textarea
                            rows={3}
                            value={
                              editForm.resolution_note
                            }
                            onChange={(e) =>
                              updateField(
                                "resolution_note",
                                e.target.value
                              )
                            }
                            placeholder="Record the result of corrective action or verification..."
                            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-3 text-sm text-white outline-none focus:border-blue-500"
                          />
                        </label>
                      </div>

                      {editForm.status ===
                        "Resolved" && (
                        <div className="mt-4 rounded-xl border border-green-800/60 bg-green-950/20 p-4">
                          <p className="text-sm font-bold text-green-400">
                            Resolution ready
                          </p>

                          <p className="mt-1 text-xs text-slate-400">
                            Saving as Resolved will record a
                            VIOLATION_RESOLVED audit event.
                          </p>
                        </div>
                      )}

                      <div className="mt-5 flex flex-wrap justify-end gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedId(
                              null
                            )
                          }
                          className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-bold text-slate-400 hover:text-white"
                        >
                          Cancel
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            void saveViolation(
                              violation
                            )
                          }
                          disabled={
                            savingId ===
                            violation.id
                          }
                          className="rounded-lg bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {savingId ===
                          violation.id
                            ? "Saving..."
                            : "Save Changes"}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] text-slate-600">
                        Reported by:{" "}
                        {violation.reported_by ||
                          "System"}
                      </p>

                      {violation.verified_by && (
                        <p className="mt-1 text-[11px] text-slate-600">
                          Verified by:{" "}
                          {violation.verified_by}
                        </p>
                      )}
                    </div>

                    {!resolved && (
                      <span className="rounded-lg border border-red-900/60 bg-red-950/20 px-3 py-2 text-xs font-bold text-red-400">
                        MANAGEMENT ATTENTION
                      </span>
                    )}
                  </div>
                </div>
              );
            }
          )
        )}
      </div>

      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h3 className="text-lg font-bold text-white">
          Escalation Workflow
        </h3>

        <p className="mt-1 text-sm text-slate-400">
          Manager workflow for detected non-compliance.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-4">
          {[
            [
              "LEVEL 1",
              "Non-Compliance Reported",
              "Inspector records a field observation.",
            ],
            [
              "LEVEL 2",
              "Management Review",
              "Manager reviews and assigns corrective action.",
            ],
            [
              "LEVEL 3",
              "Corrective Action",
              "Action progresses through verification.",
            ],
            [
              "LEVEL 4",
              "Resolution & Audit",
              "Resolution is verified and permanently logged.",
            ],
          ].map(
            (
              [
                level,
                title,
                description,
              ],
              index
            ) => (
              <div
                key={level}
                className={`rounded-xl border p-4 ${
                  index === 3
                    ? "border-green-800 bg-green-950/20"
                    : "border-slate-800 bg-slate-950"
                }`}
              >
                <p className="text-xs font-bold text-blue-400">
                  {level}
                </p>

                <p className="mt-2 font-semibold text-white">
                  {title}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  {description}
                </p>
              </div>
            )
          )}
        </div>
      </section>
    </section>
  );
}

export default AlertsCenter;