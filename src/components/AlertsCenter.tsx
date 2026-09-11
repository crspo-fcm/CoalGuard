import { useEffect, useMemo, useState } from "react";

import {
  deleteFraudAlert,
  getFraudAlerts,
  type BackendFraudAlert,
} from "../services/coalguardApi";

/* =========================================================
   TYPES
========================================================= */

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
  location_name?: string | null;
  inspector_name?: string | null;
};

type AlertStatus =
  | "Open"
  | "Acknowledged"
  | "Resolved";

type ManagerAlert = {
  id: number;
  title: string;
  category: string;
  severity: string;
  status: AlertStatus;
  description: string;
  reportedBy: string;
  assignedTo: string;
  inspectionId: number | null;
  locationName: string;
  createdAt: string;
  dueDate: string | null;
};


/* =========================================================
   HELPERS
========================================================= */

function normalize(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}


function getSeverity(
  severity: string
): "Critical" | "High" | "Moderate" | "Low" {

  const value =
    normalize(severity);

  if (value === "critical") {
    return "Critical";
  }

  if (value === "high") {
    return "High";
  }

  if (
    value === "medium" ||
    value === "moderate"
  ) {
    return "Moderate";
  }

  return "Low";
}


function convertViolation(
  violation: BackendViolation
): ManagerAlert {

  let status: AlertStatus = "Open";

  const backendStatus =
    normalize(violation.status);

  if (backendStatus === "resolved") {
    status = "Resolved";
  } else if (
    backendStatus === "under review" ||
    backendStatus === "action assigned" ||
    backendStatus === "in progress" ||
    backendStatus ===
      "awaiting verification"
  ) {
    status = "Acknowledged";
  }

  return {
    id: Number(violation.id),

    title:
      violation.title ||
      "Compliance Violation",

    category:
      violation.category ||
      "General Safety",

    severity:
      violation.severity ||
      "Medium",

    status,

    description:
      violation.description ||
      "No description provided.",

    reportedBy:
      violation.reported_by ||
      "System",

    assignedTo:
      violation.assigned_to ||
      "Not assigned",

    inspectionId:
      violation.inspection_id !== null
        ? Number(
            violation.inspection_id
          )
        : null,

    locationName:
      violation.location_name ||
      "Unknown Mine",

    createdAt:
      violation.created_at,

    dueDate:
      violation.due_date || null,
  };
}


function formatDate(
  date: string | null
): string {

  if (!date) {
    return "Not set";
  }

  const parsed =
    new Date(date);

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return "Not set";
  }

  return parsed.toLocaleString(
    "en-IN"
  );
}


function isOverdue(
  alert: ManagerAlert
): boolean {

  if (
    alert.status === "Resolved"
  ) {
    return false;
  }

  if (!alert.dueDate) {
    return false;
  }

  const due =
    new Date(
      alert.dueDate
    ).getTime();

  if (Number.isNaN(due)) {
    return false;
  }

  return due < Date.now();
}


/* =========================================================
   COMPONENT
========================================================= */

export default function AlertsCenter() {

  /* =======================================================
     STATE
  ======================================================= */

  const [
    alerts,
    setAlerts,
  ] = useState<ManagerAlert[]>([]);

  const [
    fraudAlerts,
    setFraudAlerts,
  ] = useState<BackendFraudAlert[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    selectedStatus,
    setSelectedStatus,
  ] = useState("All");

  const [
    selectedSeverity,
    setSelectedSeverity,
  ] = useState("All");

  const [
    deletingFraudId,
    setDeletingFraudId,
  ] = useState<number | null>(null);

  const [
    updatingViolationId,
    setUpdatingViolationId,
  ] = useState<number | null>(null);

  const [
    lastUpdated,
    setLastUpdated,
  ] = useState("");


  /* =======================================================
     LOAD VIOLATIONS
  ======================================================= */

  const loadViolations =
    async () => {

      const response =
        await fetch(
          "/api/violations"
        );

      const data =
        await response
          .json()
          .catch(() => ({}));

      if (!response.ok) {

        throw new Error(
          data.message ||
          "Failed to load violations."
        );

      }

      const backendViolations:
        BackendViolation[] =
        Array.isArray(
          data.violations
        )
          ? data.violations
          : [];

      return backendViolations.map(
        convertViolation
      );
    };


  /* =======================================================
     LOAD ALL BACKEND DATA
  ======================================================= */

  const loadData =
    async () => {

      try {

        const [
          violationData,
          fraudData,
        ] = await Promise.all([
          loadViolations(),
          getFraudAlerts(),
        ]);

        setAlerts(
          violationData
        );

        setFraudAlerts(
          fraudData
        );

        setError("");

        setLastUpdated(
          new Date().toLocaleTimeString(
            "en-IN"
          )
        );

      } catch (err) {

        console.error(
          "AlertsCenter:",
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : "Backend connection failed."
        );

      } finally {

        setLoading(false);

      }
    };


  /* =======================================================
     LIVE REFRESH
  ======================================================= */

  useEffect(() => {

    void loadData();

    const interval =
      window.setInterval(
        () => {
          void loadData();
        },
        3000
      );

    return () =>
      window.clearInterval(
        interval
      );

  }, []);


  /* =======================================================
     COUNTERS
     
     THESE ARE NOW 100% BACKEND BASED.
  ======================================================= */

  const openAlerts =
    useMemo(
      () =>
        alerts.filter(
          alert =>
            alert.status !==
            "Resolved"
        ),
      [alerts]
    );


  const resolvedAlerts =
    useMemo(
      () =>
        alerts.filter(
          alert =>
            alert.status ===
            "Resolved"
        ),
      [alerts]
    );


  const criticalViolations =
    useMemo(
      () =>
        openAlerts.filter(
          alert =>
            getSeverity(
              alert.severity
            ) === "Critical"
        ),
      [openAlerts]
    );


  const highViolations =
    useMemo(
      () =>
        openAlerts.filter(
          alert =>
            getSeverity(
              alert.severity
            ) === "High"
        ),
      [openAlerts]
    );


  const moderateViolations =
    useMemo(
      () =>
        openAlerts.filter(
          alert =>
            getSeverity(
              alert.severity
            ) === "Moderate"
        ),
      [openAlerts]
    );


  

  /*
   * GPS fraud attempts are critical
   * security events.
   */

  const totalCritical =
    criticalViolations.length +
    fraudAlerts.length;


  const totalHigh =
    highViolations.length;


  const totalModerate =
    moderateViolations.length;


  const totalActive =
    openAlerts.length +
    fraudAlerts.length;


  /* =======================================================
     FILTERED ALERTS
  ======================================================= */

  const filteredAlerts =
    useMemo(() => {

      return alerts.filter(
        alert => {

          const statusMatch =
            selectedStatus ===
              "All" ||
            (
              selectedStatus ===
                "Open" &&
              alert.status !==
                "Resolved"
            ) ||
            (
              selectedStatus ===
                "Resolved" &&
              alert.status ===
                "Resolved"
            );


          const severityMatch =
            selectedSeverity ===
              "All" ||
            getSeverity(
              alert.severity
            ) ===
              selectedSeverity;


          return (
            statusMatch &&
            severityMatch
          );

        }
      );

    }, [
      alerts,
      selectedStatus,
      selectedSeverity,
    ]);


  /* =======================================================
     UPDATE VIOLATION STATUS
  ======================================================= */

  const updateStatus =
    async (
      id: number,
      newStatus: AlertStatus
    ) => {

      let backendStatus =
        "Reported";

      if (
        newStatus ===
        "Acknowledged"
      ) {
        backendStatus =
          "Under Review";
      }

      if (
        newStatus ===
        "Resolved"
      ) {
        backendStatus =
          "Resolved";
      }

      try {

        setUpdatingViolationId(
          id
        );

        const response =
          await fetch(
            `/api/violations/${id}`,
            {
              method: "PATCH",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify({
                  status:
                    backendStatus,
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
            "Failed to update violation."
          );

        }


        await loadData();

      } catch (err) {

        window.alert(
          err instanceof Error
            ? err.message
            : "Failed to update violation."
        );

      } finally {

        setUpdatingViolationId(
          null
        );

      }

    };


  /* =======================================================
     DELETE GPS FRAUD ALERT
  ======================================================= */

  const handleDeleteFraud =
    async (
      id: number
    ) => {

      const confirmed =
        window.confirm(
          `Delete GPS fraud alert #${id}?`
        );

      if (!confirmed) {
        return;
      }

      try {

        setDeletingFraudId(
          id
        );

        await deleteFraudAlert(
          id
        );

        setFraudAlerts(
          current =>
            current.filter(
              alert =>
                alert.id !== id
            )
        );

      } catch (err) {

        window.alert(
          err instanceof Error
            ? err.message
            : "Failed to delete fraud alert."
        );

      } finally {

        setDeletingFraudId(
          null
        );

      }

    };


  /* =======================================================
     DELETE VIOLATION
  ======================================================= */

  const deleteViolation =
    async (
      id: number
    ) => {

      const confirmed =
        window.confirm(
          `Delete violation #${id}?`
        );

      if (!confirmed) {
        return;
      }

      try {

        setUpdatingViolationId(
          id
        );

        const response =
          await fetch(
            `/api/violations/${id}`,
            {
              method: "DELETE",
            }
          );


        const data =
          await response
            .json()
            .catch(() => ({}));


        if (!response.ok) {

          throw new Error(
            data.message ||
            "Failed to delete violation."
          );

        }


        setAlerts(
          current =>
            current.filter(
              alert =>
                alert.id !== id
            )
        );

      } catch (err) {

        window.alert(
          err instanceof Error
            ? err.message
            : "Failed to delete violation."
        );

      } finally {

        setUpdatingViolationId(
          null
        );

      }

    };


  /* =======================================================
     RENDER
  ======================================================= */

  return (

    <div
      style={{
        width: "100%",
      }}
    >


      {/* =================================================
          HEADER
      ================================================= */}

      <div
        style={{
          marginBottom:
            "24px",
        }}
      >

        <p
          style={{
            fontSize: "10px",
            letterSpacing:
              "0.22em",
            textTransform:
              "uppercase",
            color:
              "var(--cg-text-muted)",
            marginBottom:
              "8px",
          }}
        >
          GOVERNANCE & ESCALATION
        </p>


        <h2
          style={{
            fontFamily:
              'Georgia, "Times New Roman", serif',
            fontSize:
              "28px",
            margin:
              "0 0 8px",
          }}
        >
          Alerts & Escalation Center
        </h2>


        <p
          style={{
            color:
              "var(--cg-text-secondary)",
            fontSize:
              "12px",
            margin: 0,
          }}
        >
          Centralized monitoring of
          backend violations, GPS
          security events and
          management alerts.
        </p>

      </div>


      {/* =================================================
          BACKEND STATUS
      ================================================= */}

      <div
        style={{
          display: "flex",
          gap: "8px",
          flexWrap: "wrap",
          marginBottom:
            "18px",
        }}
      >

        <span
          className="cg-status cg-status-low"
        >
          <span
            className="cg-status-dot"
          />
          SQLITE BACKEND
        </span>


        <span
          className="cg-status"
        >
          LIVE FEED
        </span>


        {lastUpdated && (

          <span
            style={{
              fontSize: "10px",
              color:
                "var(--cg-text-muted)",
              padding:
                "6px 9px",
            }}
          >
            Updated{" "}
            {lastUpdated}
          </span>

        )}

      </div>


      {/* =================================================
          ERROR
      ================================================= */}

      {error && (

        <div
          style={{
            border:
              "1px solid rgba(239,68,68,.35)",
            background:
              "rgba(239,68,68,.06)",
            padding:
              "12px",
            marginBottom:
              "16px",
          }}
        >

          <strong
            style={{
              color:
                "#f87171",
              fontSize:
                "11px",
            }}
          >
            BACKEND ERROR
          </strong>


          <div
            style={{
              color:
                "var(--cg-text-secondary)",
              fontSize:
                "10px",
              marginTop:
                "4px",
            }}
          >
            {error}
          </div>

        </div>

      )}


      {/* =================================================
          KPI CARDS
      ================================================= */}

      <div
        style={{
          display:
            "grid",
          gridTemplateColumns:
            "repeat(5, minmax(0, 1fr))",
          gap:
            "10px",
        }}
      >


        {/* TOTAL */}

        <div
          className="cg-kpi"
        >

          <div className="cg-kpi-label">
            TOTAL
          </div>

          <div className="cg-kpi-value">
            {totalActive}
          </div>

          <div className="cg-kpi-note">
            Active backend alerts
          </div>

        </div>


        {/* CRITICAL */}

        <div
          className="cg-kpi"
          style={{
            borderColor:
              "rgba(239,68,68,.35)",
          }}
        >

          <div
            className="cg-kpi-label"
            style={{
              color:
                "#f87171",
            }}
          >
            CRITICAL
          </div>

          <div
            className="cg-kpi-value"
            style={{
              color:
                "#f87171",
            }}
          >
            {totalCritical}
          </div>

          <div className="cg-kpi-note">
            Critical + GPS fraud
          </div>

        </div>


        {/* HIGH */}

        <div
          className="cg-kpi"
          style={{
            borderColor:
              "rgba(249,115,22,.35)",
          }}
        >

          <div
            className="cg-kpi-label"
            style={{
              color:
                "#fb923c",
            }}
          >
            HIGH
          </div>

          <div
            className="cg-kpi-value"
            style={{
              color:
                "#fb923c",
            }}
          >
            {totalHigh}
          </div>

          <div className="cg-kpi-note">
            High-risk violations
          </div>

        </div>


        {/* MODERATE */}

        <div
          className="cg-kpi"
          style={{
            borderColor:
              "rgba(234,179,8,.35)",
          }}
        >

          <div
            className="cg-kpi-label"
            style={{
              color:
                "#facc15",
            }}
          >
            MODERATE
          </div>

          <div
            className="cg-kpi-value"
            style={{
              color:
                "#facc15",
            }}
          >
            {totalModerate}
          </div>

          <div className="cg-kpi-note">
            Medium-risk violations
          </div>

        </div>


        {/* RESOLVED */}

        <div
          className="cg-kpi"
          style={{
            borderColor:
              "rgba(34,197,94,.35)",
          }}
        >

          <div
            className="cg-kpi-label"
            style={{
              color:
                "#4ade80",
            }}
          >
            RESOLVED
          </div>

          <div
            className="cg-kpi-value"
            style={{
              color:
                "#4ade80",
            }}
          >
            {resolvedAlerts.length}
          </div>

          <div className="cg-kpi-note">
            Closed violations
          </div>

        </div>

      </div>


      {/* =================================================
          GPS FRAUD FEED
      ================================================= */}

      <section
        style={{
          marginTop:
            "18px",
          border:
            "1px solid rgba(239,68,68,.4)",
          background:
            "rgba(239,68,68,.035)",
          padding:
            "18px",
        }}
      >

        <div
          style={{
            display:
              "flex",
            justifyContent:
              "space-between",
            alignItems:
              "center",
            gap:
              "12px",
            flexWrap:
              "wrap",
          }}
        >

          <div>

            <p
              style={{
                color:
                  "#f87171",
                fontSize:
                  "10px",
                fontWeight:
                  800,
                letterSpacing:
                  "0.18em",
                margin:
                  "0 0 5px",
              }}
            >
              LIVE BACKEND SECURITY FEED
            </p>


            <h3
              style={{
                fontFamily:
                  'Georgia, "Times New Roman", serif',
                fontSize:
                  "19px",
                margin:
                  "0 0 5px",
              }}
            >
              GPS Fraud Alerts
            </h3>


            <p
              style={{
                color:
                  "var(--cg-text-secondary)",
                fontSize:
                  "10px",
                margin: 0,
              }}
            >
              Rejected inspection
              attempts outside the
              registered mine boundary.
            </p>

          </div>


          <span
            style={{
              border:
                "1px solid rgba(239,68,68,.5)",
              padding:
                "7px 10px",
              color:
                "#f87171",
              fontSize:
                "10px",
              fontWeight:
                800,
            }}
          >
            {fraudAlerts.length} LIVE ALERTS
          </span>

        </div>


        {fraudAlerts.length ===
        0 ? (

          <div
            style={{
              marginTop:
                "14px",
              padding:
                "18px",
              border:
                "1px dashed var(--cg-border)",
              textAlign:
                "center",
            }}
          >

            <strong
              style={{
                color:
                  "#4ade80",
                fontSize:
                  "11px",
              }}
            >
              ✓ No GPS fraud alerts
            </strong>

          </div>

        ) : (

          <div
            style={{
              marginTop:
                "14px",
              display:
                "grid",
              gap:
                "9px",
            }}
          >

            {fraudAlerts
              .slice(0, 10)
              .map(
                fraud => (

                  <div
                    key={
                      fraud.id
                    }
                    style={{
                      border:
                        "1px solid rgba(239,68,68,.3)",
                      background:
                        "var(--cg-surface-2)",
                      padding:
                        "13px",
                    }}
                  >

                    <div
                      style={{
                        display:
                          "flex",
                        justifyContent:
                          "space-between",
                        gap:
                          "10px",
                        flexWrap:
                          "wrap",
                      }}
                    >

                      <div>

                        <span
                          style={{
                            color:
                              "#f87171",
                            fontSize:
                              "9px",
                            fontWeight:
                              800,
                          }}
                        >
                          CRITICAL
                        </span>


                        <div
                          style={{
                            marginTop:
                              "5px",
                            fontWeight:
                              700,
                            fontSize:
                              "12px",
                          }}
                        >
                          GPS Fraud Alert #
                          {fraud.id}
                        </div>

                      </div>


                      <div
                        style={{
                          textAlign:
                            "right",
                        }}
                      >

                        <div
                          style={{
                            color:
                              "#f87171",
                            fontSize:
                              "17px",
                            fontWeight:
                              800,
                          }}
                        >
                          {Number(
                            fraud.distance_meters
                          ).toFixed(1)}{" "}
                          m
                        </div>

                        <div
                          style={{
                            color:
                              "var(--cg-text-muted)",
                            fontSize:
                              "9px",
                          }}
                        >
                          outside boundary
                        </div>

                      </div>

                    </div>


                    <div
                      style={{
                        marginTop:
                          "8px",
                        color:
                          "var(--cg-text-secondary)",
                        fontSize:
                          "10px",
                      }}
                    >
                      Inspector:{" "}
                      {
                        fraud.inspector_name ||
                        "Unknown"
                      }
                    </div>


                    <div
                      style={{
                        marginTop:
                          "3px",
                        color:
                          "var(--cg-text-secondary)",
                        fontSize:
                          "10px",
                      }}
                    >
                      Mine:{" "}
                      {
                        fraud.location_name ||
                        "Unknown"
                      }
                    </div>


                    <div
                      style={{
                        marginTop:
                          "9px",
                        padding:
                          "9px",
                        background:
                          "rgba(239,68,68,.04)",
                        color:
                          "var(--cg-text-secondary)",
                        fontSize:
                          "10px",
                      }}
                    >
                      {fraud.reason}
                    </div>


                    <div
                      style={{
                        display:
                          "flex",
                        justifyContent:
                          "space-between",
                        alignItems:
                          "center",
                        marginTop:
                          "9px",
                        gap:
                          "10px",
                        flexWrap:
                          "wrap",
                      }}
                    >

                      <span
                        style={{
                          color:
                            "var(--cg-text-muted)",
                          fontSize:
                            "9px",
                        }}
                      >
                        {formatDate(
                          fraud.created_at
                        )}
                      </span>


                      <button
                        type="button"
                        onClick={() =>
                          handleDeleteFraud(
                            fraud.id
                          )
                        }
                        disabled={
                          deletingFraudId ===
                          fraud.id
                        }
                        style={{
                          border:
                            "1px solid rgba(239,68,68,.4)",
                          background:
                            "transparent",
                          color:
                            "#f87171",
                          padding:
                            "6px 10px",
                          fontSize:
                            "9px",
                          cursor:
                            "pointer",
                        }}
                      >
                        {deletingFraudId ===
                        fraud.id
                          ? "Deleting..."
                          : "Delete Alert"}
                      </button>

                    </div>

                  </div>

                )
              )}

          </div>

        )}

      </section>


      {/* =================================================
          FILTERS
      ================================================= */}

      <section
        style={{
          marginTop:
            "18px",
          border:
            "1px solid var(--cg-border)",
          background:
            "var(--cg-surface)",
          padding:
            "15px",
        }}
      >

        <div
          style={{
            display:
              "flex",
            justifyContent:
              "space-between",
            alignItems:
              "center",
            gap:
              "12px",
            flexWrap:
              "wrap",
          }}
        >

          <div>

            <h3
              style={{
                margin:
                  "0 0 4px",
                fontSize:
                  "14px",
              }}
            >
              Backend Alert Queue
            </h3>

            <p
              style={{
                margin: 0,
                color:
                  "var(--cg-text-muted)",
                fontSize:
                  "9px",
              }}
            >
              {alerts.length} violation records
              from SQLite
            </p>

          </div>


          <div
            style={{
              display:
                "flex",
              gap:
                "5px",
              flexWrap:
                "wrap",
            }}
          >

            {[
              "All",
              "Open",
              "Resolved",
            ].map(
              status => (

                <button
                  key={
                    status
                  }
                  type="button"
                  onClick={() =>
                    setSelectedStatus(
                      status
                    )
                  }
                  style={{
                    border:
                      "1px solid var(--cg-border)",
                    background:
                      selectedStatus ===
                      status
                        ? "var(--cg-surface-2)"
                        : "transparent",
                    color:
                      selectedStatus ===
                      status
                        ? "var(--cg-text)"
                        : "var(--cg-text-muted)",
                    padding:
                      "6px 9px",
                    fontSize:
                      "9px",
                    cursor:
                      "pointer",
                  }}
                >
                  {status}
                </button>

              )
            )}

          </div>

        </div>


        <div
          style={{
            display:
              "flex",
            gap:
              "5px",
            marginTop:
              "10px",
            flexWrap:
              "wrap",
          }}
        >

          {[
            "All",
            "Critical",
            "High",
            "Moderate",
          ].map(
            severity => (

              <button
                key={
                  severity
                }
                type="button"
                onClick={() =>
                  setSelectedSeverity(
                    severity
                  )
                }
                style={{
                  border:
                    "1px solid var(--cg-border)",
                  background:
                    selectedSeverity ===
                    severity
                      ? "var(--cg-surface-2)"
                      : "transparent",
                  color:
                    selectedSeverity ===
                    severity
                      ? "var(--cg-text)"
                      : "var(--cg-text-muted)",
                  padding:
                    "6px 9px",
                  fontSize:
                    "9px",
                  cursor:
                    "pointer",
                }}
              >
                {severity}
              </button>

            )
          )}

        </div>

      </section>


      {/* =================================================
          VIOLATION LIST
      ================================================= */}

      <section
        style={{
          marginTop:
            "12px",
          display:
            "grid",
          gap:
            "10px",
        }}
      >

        {loading ? (

          <div
            style={{
              border:
                "1px solid var(--cg-border)",
              padding:
                "25px",
              textAlign:
                "center",
              color:
                "var(--cg-text-muted)",
              fontSize:
                "11px",
            }}
          >
            Loading backend violations...
          </div>

        ) : filteredAlerts.length ===
          0 ? (

          <div
            style={{
              border:
                "1px dashed var(--cg-border)",
              padding:
                "30px",
              textAlign:
                "center",
            }}
          >

            <div
              style={{
                color:
                  "#4ade80",
                fontSize:
                  "22px",
              }}
            >
              ✓
            </div>

            <div
              style={{
                marginTop:
                  "6px",
                fontWeight:
                  700,
                fontSize:
                  "12px",
              }}
            >
              No matching violations
            </div>

            <div
              style={{
                marginTop:
                  "4px",
                color:
                  "var(--cg-text-muted)",
                fontSize:
                  "9px",
              }}
            >
              Data is being read directly
              from the CoalGuard backend.
            </div>

          </div>

        ) : (

          filteredAlerts.map(
            alert => {

              const severity =
                getSeverity(
                  alert.severity
                );

              const overdue =
                isOverdue(
                  alert
                );


              return (

                <div
                  key={
                    alert.id
                  }
                  style={{
                    border:
                      "1px solid var(--cg-border)",
                    background:
                      "var(--cg-surface)",
                    padding:
                      "15px",
                  }}
                >

                  {/* HEADER */}

                  <div
                    style={{
                      display:
                        "flex",
                      justifyContent:
                        "space-between",
                      gap:
                        "12px",
                      flexWrap:
                        "wrap",
                    }}
                  >

                    <div>

                      <div
                        style={{
                          display:
                            "flex",
                          gap:
                            "6px",
                          flexWrap:
                            "wrap",
                        }}
                      >

                        <span
                          style={{
                            padding:
                              "4px 7px",
                            fontSize:
                              "8px",
                            fontWeight:
                              800,
                            color:
                              severity ===
                              "Critical"
                                ? "#f87171"
                                : severity ===
                                  "High"
                                ? "#fb923c"
                                : "#facc15",
                            border:
                              "1px solid currentColor",
                          }}
                        >
                          {severity}
                        </span>


                        <span
                          style={{
                            padding:
                              "4px 7px",
                            fontSize:
                              "8px",
                            color:
                              alert.status ===
                              "Resolved"
                                ? "#4ade80"
                                : "#f87171",
                            border:
                              "1px solid currentColor",
                          }}
                        >
                          {
                            alert.status
                          }
                        </span>

                      </div>


                      <h3
                        style={{
                          margin:
                            "8px 0 3px",
                          fontFamily:
                            'Georgia, "Times New Roman", serif',
                          fontSize:
                            "16px",
                        }}
                      >
                        {
                          alert.title
                        }
                      </h3>


                      <div
                        style={{
                          color:
                            "var(--cg-text-muted)",
                          fontSize:
                            "9px",
                        }}
                      >
                        Violation #
                        {
                          alert.id
                        }
                        {" • "}
                        {
                          alert.category
                        }
                      </div>

                    </div>


                    {overdue && (

                      <span
                        style={{
                          color:
                            "#f87171",
                          fontSize:
                            "9px",
                          fontWeight:
                            800,
                        }}
                      >
                        OVERDUE
                      </span>

                    )}

                  </div>


                  {/* DETAILS */}

                  <div
                    style={{
                      display:
                        "grid",
                      gridTemplateColumns:
                        "repeat(4, minmax(0, 1fr))",
                      gap:
                        "7px",
                      marginTop:
                        "12px",
                    }}
                  >

                    <div
                      style={{
                        background:
                          "var(--cg-surface-2)",
                        padding:
                          "9px",
                      }}
                    >

                      <div className="cg-kpi-label">
                        INSPECTION
                      </div>

                      <div
                        style={{
                          marginTop:
                            "4px",
                          fontSize:
                            "10px",
                        }}
                      >
                        {alert.inspectionId
                          ? `#${alert.inspectionId}`
                          : "N/A"}
                      </div>

                    </div>


                    <div
                      style={{
                        background:
                          "var(--cg-surface-2)",
                        padding:
                          "9px",
                      }}
                    >

                      <div className="cg-kpi-label">
                        LOCATION
                      </div>

                      <div
                        style={{
                          marginTop:
                            "4px",
                          fontSize:
                            "10px",
                        }}
                      >
                        {
                          alert.locationName
                        }
                      </div>

                    </div>


                    <div
                      style={{
                        background:
                          "var(--cg-surface-2)",
                        padding:
                          "9px",
                      }}
                    >

                      <div className="cg-kpi-label">
                        REPORTED BY
                      </div>

                      <div
                        style={{
                          marginTop:
                            "4px",
                          fontSize:
                            "10px",
                        }}
                      >
                        {
                          alert.reportedBy
                        }
                      </div>

                    </div>


                    <div
                      style={{
                        background:
                          "var(--cg-surface-2)",
                        padding:
                          "9px",
                      }}
                    >

                      <div className="cg-kpi-label">
                        ASSIGNED TO
                      </div>

                      <div
                        style={{
                          marginTop:
                            "4px",
                          fontSize:
                            "10px",
                        }}
                      >
                        {
                          alert.assignedTo
                        }
                      </div>

                    </div>

                  </div>


                  {/* DESCRIPTION */}

                  <div
                    style={{
                      marginTop:
                        "8px",
                      padding:
                        "10px",
                      background:
                        "var(--cg-surface-2)",
                    }}
                  >

                    <div
                      className="cg-kpi-label"
                    >
                      DESCRIPTION
                    </div>

                    <p
                      style={{
                        margin:
                          "5px 0 0",
                        color:
                          "var(--cg-text-secondary)",
                        fontSize:
                          "10px",
                        lineHeight:
                          1.6,
                      }}
                    >
                      {
                        alert.description
                      }
                    </p>

                  </div>


                  {/* CORRECTIVE ACTION */}

                  {alert.status !==
                    "Resolved" && (

                    <div
                      style={{
                        marginTop:
                          "8px",
                        padding:
                          "10px",
                        border:
                          "1px solid rgba(234,179,8,.25)",
                        background:
                          "rgba(234,179,8,.04)",
                      }}
                    >

                      <div
                        className="cg-kpi-label"
                      >
                        MANAGEMENT ACTION
                      </div>

                      <div
                        style={{
                          marginTop:
                            "5px",
                          fontSize:
                            "10px",
                          color:
                            "#facc15",
                        }}
                      >
                        {alert.dueDate
                          ? `Due: ${formatDate(
                              alert.dueDate
                            )}`
                          : "Corrective action pending"}

                      </div>

                    </div>

                  )}


                  {/* ACTION BUTTONS */}

                  <div
                    style={{
                      display:
                        "flex",
                      gap:
                        "7px",
                      marginTop:
                        "12px",
                      flexWrap:
                        "wrap",
                    }}
                  >

                    {alert.status ===
                      "Open" && (

                      <button
                        type="button"
                        onClick={() =>
                          updateStatus(
                            alert.id,
                            "Acknowledged"
                          )
                        }
                        disabled={
                          updatingViolationId ===
                          alert.id
                        }
                        style={{
                          background:
                            "#eab308",
                          border: "none",
                          color:
                            "#111",
                          padding:
                            "8px 12px",
                          fontSize:
                            "9px",
                          fontWeight:
                            800,
                          cursor:
                            "pointer",
                        }}
                      >
                        {updatingViolationId ===
                        alert.id
                          ? "Updating..."
                          : "ACKNOWLEDGE"}
                      </button>

                    )}


                    {alert.status ===
                      "Acknowledged" && (

                      <button
                        type="button"
                        onClick={() =>
                          updateStatus(
                            alert.id,
                            "Resolved"
                          )
                        }
                        disabled={
                          updatingViolationId ===
                          alert.id
                        }
                        style={{
                          background:
                            "#22c55e",
                          border: "none",
                          color:
                            "#07120a",
                          padding:
                            "8px 12px",
                          fontSize:
                            "9px",
                          fontWeight:
                            800,
                          cursor:
                            "pointer",
                        }}
                      >
                        {updatingViolationId ===
                        alert.id
                          ? "Updating..."
                          : "MARK RESOLVED"}
                      </button>

                    )}


                    {alert.status ===
                      "Resolved" && (

                      <span
                        style={{
                          color:
                            "#4ade80",
                          fontSize:
                            "9px",
                          padding:
                            "8px 0",
                          fontWeight:
                            800,
                        }}
                      >
                        ✓ RESOLVED
                      </span>

                    )}


                    <button
                      type="button"
                      onClick={() =>
                        deleteViolation(
                          alert.id
                        )
                      }
                      disabled={
                        updatingViolationId ===
                        alert.id
                      }
                      style={{
                        background:
                          "transparent",
                        border:
                          "1px solid rgba(239,68,68,.35)",
                        color:
                          "#f87171",
                        padding:
                          "8px 12px",
                        fontSize:
                          "9px",
                        cursor:
                          "pointer",
                      }}
                    >
                      DELETE
                    </button>

                  </div>


                  {/* TIMESTAMP */}

                  <div
                    style={{
                      marginTop:
                        "9px",
                      color:
                        "var(--cg-text-muted)",
                      fontSize:
                        "8px",
                    }}
                  >
                    Created:{" "}
                    {formatDate(
                      alert.createdAt
                    )}
                  </div>

                </div>

              );

            }
          )

        )}

      </section>


      {/* =================================================
          FOOTER INFO
      ================================================= */}

      <div
        style={{
          marginTop:
            "16px",
          padding:
            "12px",
          border:
            "1px solid var(--cg-border)",
          background:
            "var(--cg-surface-2)",
          color:
            "var(--cg-text-muted)",
          fontSize:
            "9px",
          lineHeight:
            1.6,
        }}
      >

        <strong
          style={{
            color:
              "var(--cg-text-secondary)",
          }}
        >
          LIVE BACKEND MODE:
        </strong>{" "}

        Alert statistics are calculated
        directly from SQLite violations
        and GPS fraud-alert records.
        No browser localStorage is used
        by this component.

      </div>

    </div>

  );
}