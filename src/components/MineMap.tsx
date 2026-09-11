import { useEffect, useMemo, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
} from "react-leaflet";

import "leaflet/dist/leaflet.css";

/* =========================================================
   TYPES
========================================================= */

type Mine = {
  id: number;
  name: string;
  company?: string;
  subsidiary?: string;
  state?: string;
  coalfield?: string;
  mine_type?: string;
  latitude?: number;
  longitude?: number;
  status?: string;
  compliance?: number;
};

type Inspection = {
  id: number;
  inspector_id?: number;
  location_id?: number;
  mine_id?: number;
  mine_name?: string;
  mine_company?: string;
  mine_state?: string;
  latitude?: number;
  longitude?: number;
  observation?: string;
  risk_level?: string;
  risk_score?: number;
  risk_factors?: unknown;
  risk_recommendation?: string;
  status?: string;
  created_at?: string;
};

type Location = {
  id: number;
  name?: string;
  mine_id?: number;
  latitude?: number;
  longitude?: number;
};

type Violation = {
  id: number;
  inspection_id?: number;
  title?: string;
  description?: string;
  category?: string;
  severity?: string;
  status?: string;
  assigned_to?: string;
  corrective_action?: string;
  due_date?: string;
  created_at?: string;
};

type MineRisk = {
  inspections: Inspection[];
  violations: Violation[];
  latestInspection?: Inspection;
  highestSeverity: string;
  riskLevel: string;
  riskScore: number;
};

/* =========================================================
   HELPERS
========================================================= */

function getSeverityWeight(
  severity?: string
): number {
  const value = String(
    severity || ""
  ).toUpperCase();

  if (value === "CRITICAL") return 4;
  if (value === "HIGH") return 3;
  if (value === "MEDIUM") return 2;
  if (value === "LOW") return 1;

  return 0;
}

function getRiskFromScore(
  score: number
): string {
  if (score >= 80) return "CRITICAL";
  if (score >= 60) return "HIGH";
  if (score >= 30) return "MEDIUM";

  return "LOW";
}

function getRiskColor(
  risk: string
): string {
  switch (risk) {
    case "CRITICAL":
      return "#991b1b";

    case "HIGH":
      return "#ef4444";

    case "MEDIUM":
      return "#f97316";

    case "LOW":
      return "#22c55e";

    default:
      return "#64748b";
  }
}

function getComplianceColor(
  compliance: number
): string {
  if (compliance >= 90) {
    return "#22c55e";
  }

  if (compliance >= 75) {
    return "#eab308";
  }

  if (compliance >= 60) {
    return "#f97316";
  }

  return "#ef4444";
}

function getComplianceLabel(
  compliance: number
): string {
  if (compliance >= 90) {
    return "COMPLIANT";
  }

  if (compliance >= 75) {
    return "WATCH";
  }

  if (compliance >= 60) {
    return "ATTENTION";
  }

  return "HIGH RISK";
}

/* =========================================================
   COMPONENT
========================================================= */

function MineMap() {
  const [mines, setMines] =
    useState<Mine[]>([]);

  const [inspections, setInspections] =
    useState<Inspection[]>([]);

  const [locations, setLocations] =
    useState<Location[]>([]);

  const [violations, setViolations] =
    useState<Violation[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  /* =======================================================
     LOAD LIVE DATA
  ======================================================= */

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      try {
        const [
          minesResponse,
          inspectionsResponse,
          locationsResponse,
          violationsResponse,
        ] = await Promise.all([
          fetch("/api/mines"),
          fetch("/api/inspections"),
          fetch("/api/locations"),
          fetch("/api/violations"),
        ]);

        const minesData =
          await minesResponse.json();

        const inspectionsData =
          await inspectionsResponse.json();

        const locationsData =
          await locationsResponse.json();

        const violationsData =
          await violationsResponse.json();

        if (!minesResponse.ok) {
          throw new Error(
            minesData.message ||
              "Failed to load mines."
          );
        }

        if (!inspectionsResponse.ok) {
          throw new Error(
            inspectionsData.message ||
              "Failed to load inspections."
          );
        }

        if (!locationsResponse.ok) {
          throw new Error(
            locationsData.message ||
              "Failed to load mine locations."
          );
        }

        if (!violationsResponse.ok) {
          throw new Error(
            violationsData.message ||
              "Failed to load violations."
          );
        }

        if (!active) return;

        setMines(
          Array.isArray(
            minesData.mines
          )
            ? minesData.mines
            : []
        );

        setInspections(
          Array.isArray(
            inspectionsData.inspections
          )
            ? inspectionsData.inspections
            : []
        );

        setLocations(
          Array.isArray(
            locationsData.locations
          )
            ? locationsData.locations
            : []
        );

        setViolations(
          Array.isArray(
            violationsData.violations
          )
            ? violationsData.violations
            : []
        );

        setError("");
      } catch (err) {
        console.error(
          "Mine GIS data error:",
          err
        );

        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load GIS data."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadData();

    /* =====================================================
       10 SECOND AUTO REFRESH
    ===================================================== */

    const timer =
      window.setInterval(() => {
        void loadData();
      }, 10000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  /* =======================================================
     ONLY MINES WITH VALID GPS
  ======================================================= */

  const mappedMines = useMemo(() => {
    return mines.filter(
      (mine) =>
        typeof mine.latitude ===
          "number" &&
        typeof mine.longitude ===
          "number" &&
        Number.isFinite(
          mine.latitude
        ) &&
        Number.isFinite(
          mine.longitude
        )
    );
  }, [mines]);

  /* =======================================================
     EXACT MINE RISK
     
     IMPORTANT:
     We DO NOT find the nearest mine anymore.

     Inspection:
       location_id
            ↓
       locations.mine_id
            ↓
       exact mine.id
  ======================================================= */

  const mineRiskMap = useMemo(() => {
    const result =
      new Map<number, MineRisk>();

    for (const mine of mappedMines) {

      const mineInspections =
        inspections.filter(
          (inspection) => {

            /*
             * Preferred method:
             * inspections.js now returns mine_id.
             */

            if (
              typeof inspection.mine_id ===
              "number"
            ) {
              return (
                inspection.mine_id ===
                mine.id
              );
            }

            /*
             * Fallback for older inspections:
             * location_id → locations.mine_id
             */

            if (
              typeof inspection.location_id !==
              "number"
            ) {
              return false;
            }

            const location =
              locations.find(
                (item) =>
                  item.id ===
                  inspection.location_id
              );

            return (
              location?.mine_id ===
              mine.id
            );
          }
        );

      /* ===================================================
         MATCH VIOLATIONS TO EXACT INSPECTIONS
      =================================================== */

      const inspectionIds =
        new Set(
          mineInspections.map(
            (inspection) =>
              inspection.id
          )
        );

      const mineViolations =
        violations.filter(
          (violation) =>
            typeof violation.inspection_id ===
              "number" &&
            inspectionIds.has(
              violation.inspection_id
            )
        );

      /* ===================================================
         LATEST INSPECTION
      =================================================== */

      const sortedInspections =
        [...mineInspections].sort(
          (a, b) =>
            new Date(
              b.created_at || 0
            ).getTime() -
            new Date(
              a.created_at || 0
            ).getTime()
        );

      const latestInspection =
        sortedInspections[0];

      /* ===================================================
         HIGHEST VIOLATION SEVERITY
      =================================================== */

      let highestSeverity =
        "LOW";

      for (
        const violation of mineViolations
      ) {
        if (
          getSeverityWeight(
            violation.severity
          ) >
          getSeverityWeight(
            highestSeverity
          )
        ) {
          highestSeverity =
            String(
              violation.severity ||
                "LOW"
            ).toUpperCase();
        }
      }

      /* ===================================================
         INSPECTION RISK
      =================================================== */

      let inspectionScore =
        Number(
          latestInspection?.risk_score ||
            0
        );

      const latestRiskLevel =
        String(
          latestInspection?.risk_level ||
            ""
        ).toUpperCase();

      if (
        latestRiskLevel === "RED"
      ) {
        inspectionScore =
          Math.max(
            inspectionScore,
            60
          );
      }

      /* ===================================================
         VIOLATION RISK
      =================================================== */

      const openViolations =
        mineViolations.filter(
          (violation) =>
            String(
              violation.status || ""
            ).toLowerCase() !==
            "resolved"
        );

      const violationScore =
        Math.min(
          openViolations.length * 15,
          60
        );

      const severityScore =
        getSeverityWeight(
          highestSeverity
        ) * 10;

      /* ===================================================
         FINAL RISK SCORE
      =================================================== */

      const riskScore =
        Math.min(
          Math.max(
            inspectionScore,
            violationScore +
              severityScore
          ),
          100
        );

      let riskLevel =
        getRiskFromScore(
          riskScore
        );

      /*
       * High/Critical violations cannot
       * result in a LOW marker.
       */

      if (
        highestSeverity ===
        "CRITICAL"
      ) {
        riskLevel = "CRITICAL";
      } else if (
        highestSeverity === "HIGH" &&
        riskLevel === "LOW"
      ) {
        riskLevel = "HIGH";
      }

      result.set(
        mine.id,
        {
          inspections:
            mineInspections,

          violations:
            mineViolations,

          latestInspection,

          highestSeverity,

          riskLevel,

          riskScore,
        }
      );
    }

    return result;
  }, [
    mappedMines,
    inspections,
    locations,
    violations,
  ]);

  /* =======================================================
     MAP BOUNDS
  ======================================================= */

  const mapBounds = useMemo(() => {

    if (
      mappedMines.length === 0
    ) {
      return [
        [8.0, 68.0],
        [35.0, 97.0],
      ] as [
        [number, number],
        [number, number]
      ];
    }

    const latitudes =
      mappedMines.map(
        (mine) =>
          mine.latitude as number
      );

    const longitudes =
      mappedMines.map(
        (mine) =>
          mine.longitude as number
      );

    const minLat =
      Math.min(...latitudes);

    const maxLat =
      Math.max(...latitudes);

    const minLng =
      Math.min(...longitudes);

    const maxLng =
      Math.max(...longitudes);

    const paddingLat =
      Math.max(
        1.5,
        (maxLat - minLat) *
          0.12
      );

    const paddingLng =
      Math.max(
        1.5,
        (maxLng - minLng) *
          0.12
      );

    return [
      [
        minLat - paddingLat,
        minLng - paddingLng,
      ],
      [
        maxLat + paddingLat,
        maxLng + paddingLng,
      ],
    ] as [
      [number, number],
      [number, number]
    ];

  }, [mappedMines]);

  /* =======================================================
     RISK SUMMARY
  ======================================================= */

  const riskSummary = useMemo(() => {

    let critical = 0;
    let high = 0;
    let medium = 0;
    let low = 0;

    for (
      const mine of mappedMines
    ) {

      const risk =
        mineRiskMap.get(
          mine.id
        );

      switch (
        risk?.riskLevel
      ) {
        case "CRITICAL":
          critical++;
          break;

        case "HIGH":
          high++;
          break;

        case "MEDIUM":
          medium++;
          break;

        default:
          low++;
      }
    }

    return {
      critical,
      high,
      medium,
      low,
    };

  }, [
    mappedMines,
    mineRiskMap,
  ]);

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <div
        style={{
          minHeight: "500px",
          display: "flex",
          alignItems: "center",
          justifyContent:
            "center",
          border:
            "1px solid var(--cg-border)",
          background:
            "var(--cg-surface-2)",
          color:
            "var(--cg-text-secondary)",
          fontSize: "12px",
        }}
      >
        Loading live mine GIS...
      </div>
    );
  }

  /* =======================================================
     ERROR
  ======================================================= */

  if (error) {
    return (
      <div
        style={{
          minHeight: "300px",
          display: "flex",
          alignItems: "center",
          justifyContent:
            "center",
          flexDirection: "column",
          gap: "8px",
          border:
            "1px solid rgba(239,68,68,.35)",
          background:
            "var(--cg-surface-2)",
          color: "#f87171",
          fontSize: "12px",
          padding: "20px",
          textAlign: "center",
        }}
      >
        <strong>
          Mine GIS unavailable
        </strong>

        <span
          style={{
            color:
              "var(--cg-text-secondary)",
            fontSize: "10px",
          }}
        >
          {error}
        </span>
      </div>
    );
  }

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
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "center",
          gap: "12px",
          flexWrap: "wrap",
          marginBottom: "10px",
        }}
      >

        <div>

          <div
            style={{
              fontSize: "11px",
              fontWeight: 700,
              color:
                "var(--cg-text)",
              letterSpacing:
                "0.04em",
            }}
          >
            INDIA COAL MINE GIS
          </div>

          <div
            style={{
              marginTop: "3px",
              fontSize: "9px",
              color:
                "var(--cg-text-muted)",
            }}
          >
            Live mine registry + exact
            inspection risk + violations
          </div>

        </div>

        <div
          style={{
            display: "flex",
            gap: "7px",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >

          <span className="cg-status cg-status-low">
            {mappedMines.length} Mapped
          </span>

          <span className="cg-status">
            {mines.length} Registered
          </span>

          <span
            className="cg-status"
            style={{
              borderColor:
                "rgba(34,197,94,.35)",
              color:
                "#22c55e",
            }}
          >
            LIVE
          </span>

        </div>

      </div>

      {/* =================================================
          RISK SUMMARY
      ================================================= */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(4, minmax(0, 1fr))",
          gap: "7px",
          marginBottom: "10px",
        }}
      >

        <div
          style={{
            padding:
              "8px 10px",
            border:
              "1px solid rgba(153,27,27,.35)",
            background:
              "rgba(153,27,27,.08)",
          }}
        >

          <div
            style={{
              fontSize: "9px",
              color:
                "var(--cg-text-muted)",
            }}
          >
            CRITICAL
          </div>

          <strong
            style={{
              fontSize: "16px",
              color:
                "#991b1b",
            }}
          >
            {riskSummary.critical}
          </strong>

        </div>


        <div
          style={{
            padding:
              "8px 10px",
            border:
              "1px solid rgba(239,68,68,.35)",
            background:
              "rgba(239,68,68,.07)",
          }}
        >

          <div
            style={{
              fontSize: "9px",
              color:
                "var(--cg-text-muted)",
            }}
          >
            HIGH
          </div>

          <strong
            style={{
              fontSize: "16px",
              color:
                "#ef4444",
            }}
          >
            {riskSummary.high}
          </strong>

        </div>


        <div
          style={{
            padding:
              "8px 10px",
            border:
              "1px solid rgba(249,115,22,.35)",
            background:
              "rgba(249,115,22,.07)",
          }}
        >

          <div
            style={{
              fontSize: "9px",
              color:
                "var(--cg-text-muted)",
            }}
          >
            MEDIUM
          </div>

          <strong
            style={{
              fontSize: "16px",
              color:
                "#f97316",
            }}
          >
            {riskSummary.medium}
          </strong>

        </div>


        <div
          style={{
            padding:
              "8px 10px",
            border:
              "1px solid rgba(34,197,94,.35)",
            background:
              "rgba(34,197,94,.07)",
          }}
        >

          <div
            style={{
              fontSize: "9px",
              color:
                "var(--cg-text-muted)",
            }}
          >
            LOW
          </div>

          <strong
            style={{
              fontSize: "16px",
              color:
                "#22c55e",
            }}
          >
            {riskSummary.low}
          </strong>

        </div>

      </div>

      {/* =================================================
          MAP
      ================================================= */}

      <div
        style={{
          height: "560px",
          width: "100%",
          border:
            "1px solid var(--cg-border)",
          overflow: "hidden",
        }}
      >

        <MapContainer
          bounds={mapBounds}
          scrollWheelZoom={true}
          style={{
            width: "100%",
            height: "100%",
          }}
        >

          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* =================================================
              29 REGISTERED MINE MARKERS
          ================================================= */}

          {mappedMines.map(
            (mine) => {

              const compliance =
                Number(
                  mine.compliance ??
                    0
                );

              const risk =
                mineRiskMap.get(
                  mine.id
                );

              const riskColor =
                getRiskColor(
                  risk?.riskLevel ||
                    "LOW"
                );

              /*
               * If this mine has an actual inspection,
               * use live risk colour.
               *
               * Otherwise use registry compliance.
               */

              const markerColor =
                risk &&
                risk.inspections
                  .length > 0
                  ? riskColor
                  : getComplianceColor(
                      compliance
                    );

              const openViolations =
                risk?.violations.filter(
                  (violation) =>
                    String(
                      violation.status ||
                        ""
                    ).toLowerCase() !==
                    "resolved"
                ).length || 0;

              return (
                <CircleMarker
                  key={mine.id}
                  center={[
                    mine.latitude as number,
                    mine.longitude as number,
                  ]}
                  radius={10}
                  pathOptions={{
                    color:
                      "#ffffff",
                    weight: 2,
                    fillColor:
                      markerColor,
                    fillOpacity:
                      0.9,
                  }}
                >

                  <Popup>

                    <div
                      style={{
                        minWidth:
                          "240px",
                        fontFamily:
                          "Arial, sans-serif",
                        fontSize:
                          "12px",
                        lineHeight:
                          1.5,
                      }}
                    >

                      {/* MINE NAME */}

                      <div
                        style={{
                          fontSize:
                            "14px",
                          fontWeight:
                            700,
                          marginBottom:
                            "6px",
                        }}
                      >
                        {mine.name}
                      </div>


                      <div>
                        <strong>
                          Mine ID:
                        </strong>{" "}
                        #{mine.id}
                      </div>


                      {mine.company && (
                        <div>
                          <strong>
                            Company:
                          </strong>{" "}
                          {mine.company}
                        </div>
                      )}


                      {mine.subsidiary && (
                        <div>
                          <strong>
                            Subsidiary:
                          </strong>{" "}
                          {mine.subsidiary}
                        </div>
                      )}


                      {mine.state && (
                        <div>
                          <strong>
                            State:
                          </strong>{" "}
                          {mine.state}
                        </div>
                      )}


                      {mine.coalfield && (
                        <div>
                          <strong>
                            Coalfield:
                          </strong>{" "}
                          {mine.coalfield}
                        </div>
                      )}


                      {mine.mine_type && (
                        <div>
                          <strong>
                            Type:
                          </strong>{" "}
                          {mine.mine_type}
                        </div>
                      )}


                      <div>
                        <strong>
                          Status:
                        </strong>{" "}
                        {mine.status ||
                          "Unknown"}
                      </div>


                      {/* =================================================
                          LIVE GOVERNANCE RISK
                      ================================================= */}

                      <div
                        style={{
                          marginTop:
                            "8px",
                          paddingTop:
                            "7px",
                          borderTop:
                            "1px solid #ddd",
                        }}
                      >

                        <div
                          style={{
                            fontSize:
                              "10px",
                            fontWeight:
                              700,
                            color:
                              "#666",
                            marginBottom:
                              "3px",
                          }}
                        >
                          LIVE GOVERNANCE RISK
                        </div>


                        <div
                          style={{
                            fontSize:
                              "14px",
                            fontWeight:
                              800,
                            color:
                              markerColor,
                          }}
                        >
                          {risk?.riskLevel ||
                            "LOW"}
                        </div>


                        <div>
                          <strong>
                            Risk Score:
                          </strong>{" "}
                          {risk?.riskScore ||
                            0}
                          /100
                        </div>


                        <div>
                          <strong>
                            Open Violations:
                          </strong>{" "}
                          {openViolations}
                        </div>


                        <div>
                          <strong>
                            Inspections:
                          </strong>{" "}
                          {risk?.inspections
                            .length ||
                            0}
                        </div>


                        <div>
                          <strong>
                            Highest Severity:
                          </strong>{" "}
                          {risk?.highestSeverity ||
                            "LOW"}
                        </div>

                      </div>


                      {/* =================================================
                          LATEST INSPECTION
                      ================================================= */}

                      {risk?.latestInspection && (
                        <div
                          style={{
                            marginTop:
                              "8px",
                            paddingTop:
                              "7px",
                            borderTop:
                              "1px solid #ddd",
                          }}
                        >

                          <div
                            style={{
                              fontSize:
                                "10px",
                              fontWeight:
                                700,
                              color:
                                "#666",
                              marginBottom:
                                "3px",
                            }}
                          >
                            LATEST INSPECTION
                          </div>


                          <div>
                            <strong>
                              Risk:
                            </strong>{" "}
                            {String(
                              risk
                                .latestInspection
                                .risk_level ||
                                "GREEN"
                            ).toUpperCase()}
                          </div>


                          <div>
                            <strong>
                              Score:
                            </strong>{" "}
                            {Number(
                              risk
                                .latestInspection
                                .risk_score ||
                                0
                            )}
                          </div>


                          {risk
                            .latestInspection
                            .observation && (
                            <div
                              style={{
                                marginTop:
                                  "4px",
                                fontSize:
                                  "10px",
                              }}
                            >
                              <strong>
                                Observation:
                              </strong>{" "}
                              {
                                risk
                                  .latestInspection
                                  .observation
                              }
                            </div>
                          )}


                          {risk
                            .latestInspection
                            .risk_recommendation && (
                            <div
                              style={{
                                marginTop:
                                  "4px",
                                fontSize:
                                  "10px",
                              }}
                            >
                              <strong>
                                Action:
                              </strong>{" "}
                              {
                                risk
                                  .latestInspection
                                  .risk_recommendation
                              }
                            </div>
                          )}

                        </div>
                      )}


                      {/* =================================================
                          COMPLIANCE
                      ================================================= */}

                      <div
                        style={{
                          marginTop:
                            "8px",
                          paddingTop:
                            "7px",
                          borderTop:
                            "1px solid #ddd",
                        }}
                      >

                        <strong>
                          Registry Compliance:
                        </strong>{" "}

                        <span
                          style={{
                            color:
                              getComplianceColor(
                                compliance
                              ),
                            fontWeight:
                              700,
                          }}
                        >
                          {compliance}%
                        </span>

                      </div>


                      <div
                        style={{
                          marginTop:
                            "3px",
                          fontSize:
                            "10px",
                          fontWeight:
                            700,
                        }}
                      >
                        {getComplianceLabel(
                          compliance
                        )}
                      </div>


                      {/* GPS */}

                      <div
                        style={{
                          marginTop:
                            "7px",
                          paddingTop:
                            "6px",
                          borderTop:
                            "1px solid #ddd",
                          fontSize:
                            "9px",
                          color:
                            "#666",
                        }}
                      >
                        GPS:{" "}
                        {Number(
                          mine.latitude
                        ).toFixed(4)}
                        ,{" "}
                        {Number(
                          mine.longitude
                        ).toFixed(4)}
                      </div>

                    </div>

                  </Popup>

                </CircleMarker>
              );
            }
          )}

        </MapContainer>

      </div>


      {/* =================================================
          LEGEND
      ================================================= */}

      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "center",
          gap: "12px",
          flexWrap: "wrap",
          marginTop: "9px",
          padding:
            "9px 11px",
          border:
            "1px solid var(--cg-border)",
          background:
            "var(--cg-surface-2)",
          fontSize: "9px",
        }}
      >

        <div
          style={{
            display: "flex",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >

          <span>
            🟢 LOW
          </span>

          <span>
            🟠 MEDIUM
          </span>

          <span>
            🔴 HIGH
          </span>

          <span>
            🔴 CRITICAL
          </span>

        </div>


        <span
          style={{
            color:
              "var(--cg-text-muted)",
          }}
        >
          OpenStreetMap GIS
        </span>

      </div>


      {/* =================================================
          REGISTRY STATUS
      ================================================= */}

      <div
        style={{
          marginTop: "7px",
          fontSize: "9px",
          color:
            "var(--cg-text-muted)",
        }}
      >

        Registry:{" "}
        <strong>
          {mines.length}
        </strong>{" "}
        mines • GIS coordinates:{" "}
        <strong>
          {mappedMines.length}
        </strong>{" "}
        • Inspections:{" "}
        <strong>
          {inspections.length}
        </strong>{" "}
        • Violations:{" "}
        <strong>
          {violations.length}
        </strong>{" "}
        • Auto-refresh:{" "}
        <strong>
          10 sec
        </strong>

      </div>

    </div>
  );
}

export default MineMap;