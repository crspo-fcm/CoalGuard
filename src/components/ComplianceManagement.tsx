import { useEffect, useMemo, useState } from "react";

type ComplianceStatus =
  | "Compliant"
  | "Non-Compliant"
  | "Pending";

type ComplianceItem = {
  id: number;
  title: string;
  keywords: string[];
  status: ComplianceStatus;
  relatedViolations: number;
};

type ComplianceCategory = {
  name: string;
  icon: string;
  items: ComplianceItem[];
};

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

const complianceTemplate: {
  name: string;
  icon: string;
  items: {
    id: number;
    title: string;
    keywords: string[];
  }[];
}[] = [
  {
    name: "Safety Compliance",
    icon: "🦺",
    items: [
      {
        id: 1,
        title: "Personal Protective Equipment",
        keywords: [
          "ppe",
          "helmet",
          "safety equipment",
          "protective equipment",
        ],
      },
      {
        id: 2,
        title: "Emergency equipment inspection",
        keywords: ["emergency", "equipment"],
      },
      {
        id: 3,
        title: "Mine ventilation safety",
        keywords: ["ventilation", "gas"],
      },
      {
        id: 4,
        title: "Fire safety requirements",
        keywords: ["fire", "smoke", "explosion"],
      },
      {
        id: 5,
        title: "Electrical safety inspection",
        keywords: ["electrical", "electric", "wiring"],
      },
      {
        id: 6,
        title: "Explosive and blasting safety",
        keywords: ["explosive", "explosion", "blasting"],
      },
      {
        id: 7,
        title: "Worker safety training records",
        keywords: ["worker", "training", "safety"],
      },
    ],
  },

  {
    name: "Environmental Compliance",
    icon: "🌱",
    items: [
      {
        id: 8,
        title: "Air quality monitoring",
        keywords: ["air", "gas", "dust"],
      },
      {
        id: 9,
        title: "Water pollution monitoring",
        keywords: ["water", "pollution", "flood"],
      },
      {
        id: 10,
        title: "Waste management",
        keywords: ["waste"],
      },
      {
        id: 11,
        title: "Land reclamation monitoring",
        keywords: ["land", "reclamation"],
      },
      {
        id: 12,
        title: "Dust suppression measures",
        keywords: ["dust"],
      },
      {
        id: 13,
        title: "Noise level monitoring",
        keywords: ["noise"],
      },
      {
        id: 14,
        title: "Environmental clearance conditions",
        keywords: ["environment", "clearance"],
      },
    ],
  },

  {
    name: "Production Compliance",
    icon: "⚙️",
    items: [
      {
        id: 15,
        title: "Production target monitoring",
        keywords: ["production"],
      },
      {
        id: 16,
        title: "Equipment operational checks",
        keywords: ["equipment", "machinery"],
      },
      {
        id: 17,
        title: "Coal stock monitoring",
        keywords: ["coal stock", "stock"],
      },
      {
        id: 18,
        title: "Machinery maintenance records",
        keywords: ["machinery", "maintenance"],
      },
      {
        id: 19,
        title: "Haul road condition inspection",
        keywords: ["haul road", "road"],
      },
      {
        id: 20,
        title: "Conveyor system inspection",
        keywords: ["conveyor"],
      },
      {
        id: 21,
        title: "Production data verification",
        keywords: ["production data", "production"],
      },
    ],
  },

  {
    name: "Labour Compliance",
    icon: "👷",
    items: [
      {
        id: 22,
        title: "Worker attendance records",
        keywords: ["attendance", "worker"],
      },
      {
        id: 23,
        title: "Working hours compliance",
        keywords: ["working hours", "hours"],
      },
      {
        id: 24,
        title: "Worker medical examination",
        keywords: ["medical", "health"],
      },
      {
        id: 25,
        title: "Labour welfare facilities",
        keywords: ["welfare", "labour"],
      },
      {
        id: 26,
        title: "Worker training compliance",
        keywords: ["training", "worker"],
      },
      {
        id: 27,
        title: "Accident and incident records",
        keywords: ["accident", "incident", "injury"],
      },
      {
        id: 28,
        title: "Contract worker documentation",
        keywords: ["contract worker", "worker documentation"],
      },
    ],
  },
];

function normalize(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function violationMatchesItem(
  violation: BackendViolation,
  keywords: string[]
): boolean {
  const text = [
    violation.title,
    violation.description,
    violation.category,
    violation.corrective_action,
    violation.inspection_observation,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return keywords.some((keyword) =>
    text.includes(keyword.toLowerCase())
  );
}



function ComplianceManagement() {
  const [violations, setViolations] = useState<
    BackendViolation[]
  >([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [lastUpdated, setLastUpdated] =
    useState("");

  const [selectedCategory, setSelectedCategory] =
    useState<string | null>(null);

  /*
  =========================================================
  LOAD LIVE SQLITE VIOLATIONS
  =========================================================
  */

  const loadViolations = async (
    initial = false
  ) => {
    try {
      if (initial) {
        setLoading(true);
      }

      const response = await fetch(
        "/api/violations"
      );

      const data = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Unable to load violations."
        );
      }

      const records = Array.isArray(
        data.violations
      )
        ? data.violations
        : [];

      setViolations(records);
      setError("");
      setLastUpdated(
        new Date().toLocaleTimeString()
      );
    } catch (err) {
      console.error(
        "Compliance API error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to connect to compliance backend."
      );
    } finally {
      if (initial) {
        setLoading(false);
      }
    }
  };

  /*
  =========================================================
  LIVE REFRESH
  =========================================================
  */

  useEffect(() => {
    void loadViolations(true);

    const timer =
      window.setInterval(() => {
        void loadViolations(false);
      }, 3000);

    return () =>
      window.clearInterval(timer);
  }, []);

  /*
  =========================================================
  ACTIVE / RESOLVED
  =========================================================
  */

  const activeViolations =
    useMemo(
      () =>
        violations.filter(
          (violation) =>
            normalize(
              violation.status
            ) !== "resolved"
        ),
      [violations]
    );

  const resolvedViolations =
    useMemo(
      () =>
        violations.filter(
          (violation) =>
            normalize(
              violation.status
            ) === "resolved"
        ),
      [violations]
    );

  /*
  =========================================================
  SEVERITY
  =========================================================
  */

  const criticalViolations =
    useMemo(
      () =>
        activeViolations.filter(
          (violation) =>
            normalize(
              violation.severity
            ) === "critical"
        ),
      [activeViolations]
    );

  const highViolations =
    useMemo(
      () =>
        activeViolations.filter(
          (violation) =>
            normalize(
              violation.severity
            ) === "high"
        ),
      [activeViolations]
    );

  /*
  =========================================================
  LIVE COMPLIANCE CATEGORIES
  =========================================================
  */

  const categories =
    useMemo<ComplianceCategory[]>(
      () =>
        complianceTemplate.map(
          (template) => ({
            name: template.name,
            icon: template.icon,

            items: template.items.map(
              (item) => {
                const matches =
                  activeViolations.filter(
                    (violation) =>
                      violationMatchesItem(
                        violation,
                        item.keywords
                      )
                  );

                let status:
                  | ComplianceStatus =
                  "Pending";

                if (
                  matches.length > 0
                ) {
                  status =
                    "Non-Compliant";
                } else if (
                  violations.length > 0
                ) {
                  status = "Compliant";
                }

                return {
                  id: item.id,
                  title: item.title,
                  keywords:
                    item.keywords,
                  status,
                  relatedViolations:
                    matches.length,
                };
              }
            ),
          })
        ),
      [activeViolations, violations.length]
    );

  /*
  =========================================================
  OVERALL SCORE
  =========================================================
  */

  const allItems =
    categories.flatMap(
      (category) =>
        category.items
    );

  const assessedItems =
    allItems.filter(
      (item) =>
        item.status !== "Pending"
    );

  const compliantItems =
    allItems.filter(
      (item) =>
        item.status === "Compliant"
    );

 

  const pendingItems =
    allItems.filter(
      (item) =>
        item.status === "Pending"
    );

  const overallScore =
    assessedItems.length === 0
      ? 0
      : Math.round(
          (compliantItems.length /
            assessedItems.length) *
            100
        );

  /*
  =========================================================
  MANAGER ESCALATION ALERTS
  =========================================================
  */

  const managerAlerts =
    useMemo(
      () =>
        activeViolations.filter(
          (violation) => {
            const severity =
              normalize(
                violation.severity
              );

            return (
              severity === "high" ||
              severity === "critical"
            );
          }
        ),
      [activeViolations]
    );

  /*
  =========================================================
  CATEGORY RISK
  =========================================================
  */

  const categoryRisk =
    useMemo(
      () =>
        categories.map(
          (category) => {
            const assessed =
              category.items.filter(
                (item) =>
                  item.status !==
                  "Pending"
              );

            const compliant =
              assessed.filter(
                (item) =>
                  item.status ===
                  "Compliant"
              );

            const score =
              assessed.length === 0
                ? 0
                : Math.round(
                    (compliant.length /
                      assessed.length) *
                      100
                  );

            const failed =
              category.items.filter(
                (item) =>
                  item.status ===
                  "Non-Compliant"
              ).length;

            return {
              name: category.name,
              score,
              failed,
            };
          }
        ),
      [categories]
    );

  /*
  =========================================================
  CATEGORY SCORE
  =========================================================
  */

  const getCategoryScore = (
    items: ComplianceItem[]
  ) => {
    const assessed =
      items.filter(
        (item) =>
          item.status !== "Pending"
      );

    if (assessed.length === 0) {
      return 0;
    }

    const compliant =
      assessed.filter(
        (item) =>
          item.status === "Compliant"
      ).length;

    return Math.round(
      (compliant /
        assessed.length) *
        100
    );
  };

  /*
  =========================================================
  SCORE STYLE
  =========================================================
  */

  const getScoreClass = (
    score: number
  ) => {
    if (score >= 90) {
      return "text-green-400";
    }

    if (score >= 70) {
      return "text-yellow-400";
    }

    return "text-red-400";
  };

  /*
  =========================================================
  STATUS STYLE
  =========================================================
  */

  const getStatusClass = (
    status: ComplianceStatus
  ) => {
    if (status === "Compliant") {
      return "border-green-500 bg-green-500/10 text-green-400";
    }

    if (
      status === "Non-Compliant"
    ) {
      return "border-red-500 bg-red-500/10 text-red-400";
    }

    return "border-yellow-500 bg-yellow-500/10 text-yellow-400";
  };

  /*
  =========================================================
  RENDER
  =========================================================
  */

  return (
    <section className="mt-8 px-4">

      {/* BACKEND STATUS */}

      <div className="mb-5 flex flex-wrap items-center gap-2">

        <span className="rounded-full border border-green-400/20 bg-green-400/10 px-3 py-1 text-xs font-bold text-green-400">
          ● SQLITE BACKEND
        </span>

        <span className="rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-xs font-bold text-blue-400">
          LIVE COMPLIANCE
        </span>

        {lastUpdated && (
          <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-bold text-slate-500">
            Updated {lastUpdated}
          </span>
        )}

      </div>

      {/* ERROR */}

      {error && (
        <div className="mb-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4">

          <p className="font-bold text-red-400">
            Compliance Backend Error
          </p>

          <p className="mt-1 text-sm text-slate-400">
            {error}
          </p>

        </div>
      )}

      {/* MANAGER ALERTS */}

      {managerAlerts.length > 0 && (
        <div className="mb-6 rounded-2xl border border-red-900 bg-red-950/20 p-6">

          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

            <div>

              <p className="text-xs font-bold uppercase tracking-widest text-red-400">
                Automated Escalation
              </p>

              <h2 className="mt-1 text-xl font-bold text-white">
                🚨 Manager Alerts
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                High and critical violations
                requiring management attention.
              </p>

            </div>

            <div className="rounded-full border border-red-700 bg-red-900/30 px-4 py-2 text-sm font-bold text-red-400">
              {managerAlerts.length} Active
            </div>

          </div>

          <div className="space-y-3">

            {managerAlerts.map(
              (violation) => (
                <div
                  key={violation.id}
                  className="rounded-xl border border-slate-700 bg-slate-950 p-4"
                >

                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

                    <div>

                      <div className="flex flex-wrap items-center gap-2">

                        <span className="rounded-md bg-red-500/10 px-2 py-1 text-xs font-bold text-red-400">
                          {String(
                            violation.severity
                          ).toUpperCase()}
                        </span>

                        <span className="text-xs text-slate-500">
                          Violation #
                          {violation.id}
                        </span>

                      </div>

                      <h3 className="mt-2 font-bold text-white">
                        {violation.title}
                      </h3>

                      <p className="mt-1 text-sm text-slate-400">
                        Category:{" "}
                        {violation.category}
                      </p>

                      <p className="text-sm text-slate-400">
                        Location:{" "}
                        {violation.location_name ||
                          "Unknown location"}
                      </p>

                      {violation.inspection_id && (
                        <p className="text-sm text-slate-400">
                          Inspection: #
                          {
                            violation.inspection_id
                          }
                        </p>
                      )}

                    </div>

                    <div className="text-left md:text-right">

                      <p className="font-bold text-red-400">
                        MANAGEMENT ATTENTION
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Status:{" "}
                        {violation.status}
                      </p>

                      <p className="text-xs text-slate-500">
                        Reported by:{" "}
                        {violation.reported_by ||
                          "System"}
                      </p>

                      <p className="text-xs text-slate-500">
                        {new Date(
                          violation.created_at
                        ).toLocaleString()}
                      </p>

                    </div>

                  </div>

                </div>
              )
            )}

          </div>

        </div>
      )}

      {/* MAIN PANEL */}

      <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6">

        {/* HEADER */}

        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

          <div>

            <p className="text-xs font-bold uppercase tracking-widest text-cyan-400">
              Regulatory Intelligence
            </p>

            <h2 className="mt-1 text-2xl font-bold text-white">
              Compliance Management
            </h2>

            <p className="mt-1 text-sm text-slate-400">
              Live compliance assessment derived
              from SQLite-backed field violations.
            </p>

          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-950 px-5 py-3">

            <p className="text-xs text-slate-400">
              Overall Compliance
            </p>

            <p
              className={`text-3xl font-bold ${getScoreClass(
                overallScore
              )}`}
            >
              {overallScore}%
            </p>

          </div>

        </div>

        {/* SUMMARY */}

        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">

          <div className="rounded-xl border border-slate-700 bg-slate-950 p-4">
            <p className="text-xs text-slate-400">
              Backend Violations
            </p>

            <p className="mt-1 text-2xl font-bold text-white">
              {violations.length}
            </p>
          </div>

          <div className="rounded-xl border border-red-900 bg-red-950/30 p-4">
            <p className="text-xs text-red-300">
              Active Violations
            </p>

            <p className="mt-1 text-2xl font-bold text-red-400">
              {activeViolations.length}
            </p>
          </div>

          <div className="rounded-xl border border-orange-900 bg-orange-950/30 p-4">
            <p className="text-xs text-orange-300">
              Critical / High
            </p>

            <p className="mt-1 text-2xl font-bold text-orange-400">
              {criticalViolations.length +
                highViolations.length}
            </p>
          </div>

          <div className="rounded-xl border border-yellow-900 bg-yellow-950/30 p-4">
            <p className="text-xs text-yellow-300">
              Pending Assessment
            </p>

            <p className="mt-1 text-2xl font-bold text-yellow-400">
              {pendingItems.length}
            </p>
          </div>

          <div className="rounded-xl border border-green-900 bg-green-950/30 p-4">
            <p className="text-xs text-green-300">
              Resolved Violations
            </p>

            <p className="mt-1 text-2xl font-bold text-green-400">
              {resolvedViolations.length}
            </p>
          </div>

        </div>

        {/* CATEGORY POSITION */}

        <div className="mb-6 rounded-2xl border border-slate-800 bg-black/20 p-4">

          <p className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-500">
            Live Compliance Position
          </p>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

            {categoryRisk.map(
              (category) => (
                <button
                  key={category.name}
                  type="button"
                  onClick={() =>
                    setSelectedCategory(
                      selectedCategory ===
                        category.name
                        ? null
                        : category.name
                    )
                  }
                  className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-left transition hover:border-slate-600"
                >

                  <div className="flex items-center justify-between">

                    <span className="font-bold text-white">
                      {category.name}
                    </span>

                    <span
                      className={`font-black ${getScoreClass(
                        category.score
                      )}`}
                    >
                      {category.score}%
                    </span>

                  </div>

                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">

                    <div
                      className={`h-full rounded-full transition-all ${
                        category.score >= 90
                          ? "bg-green-400"
                          : category.score >=
                              70
                            ? "bg-yellow-400"
                            : "bg-red-400"
                      }`}
                      style={{
                        width: `${Math.max(
                          category.score,
                          2
                        )}%`,
                      }}
                    />

                  </div>

                  <p className="mt-2 text-xs text-slate-500">
                    {category.failed > 0
                      ? `${category.failed} compliance area(s) affected`
                      : "No active violations detected"}
                  </p>

                </button>
              )
            )}

          </div>

        </div>

        {/* LOADING */}

        {loading && (
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 text-center">

            <p className="font-bold text-slate-300">
              Loading live compliance data...
            </p>

          </div>
        )}

        {/* CATEGORIES */}

        {!loading && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

            {categories.map(
              (category) => {

                const visible =
                  !selectedCategory ||
                  selectedCategory ===
                    category.name;

                if (!visible) {
                  return null;
                }

                const score =
                  getCategoryScore(
                    category.items
                  );

                return (
                  <div
                    key={category.name}
                    className="rounded-xl border border-slate-700 bg-slate-950 p-4"
                  >

                    {/* CATEGORY HEADER */}

                    <div className="mb-4 flex items-center justify-between">

                      <div className="flex items-center gap-3">

                        <span className="text-2xl">
                          {category.icon}
                        </span>

                        <div>

                          <h3 className="font-bold text-white">
                            {category.name}
                          </h3>

                          <p className="text-xs text-slate-400">
                            Compliance score:{" "}
                            {score}%
                          </p>

                        </div>

                      </div>

                      <div
                        className={`rounded-full border px-3 py-1 text-sm font-bold ${getStatusClass(
                          score >= 80
                            ? "Compliant"
                            : score > 0
                              ? "Non-Compliant"
                              : "Pending"
                        )}`}
                      >
                        {score}%
                      </div>

                    </div>

                    {/* ITEMS */}

                    <div className="space-y-3">

                      {category.items.map(
                        (item) => (
                          <div
                            key={item.id}
                            className="rounded-xl border border-slate-800 bg-slate-900 p-3"
                          >

                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

                              <div>

                                <p className="text-sm font-semibold text-white">
                                  {item.title}
                                </p>

                                {item.relatedViolations >
                                  0 && (
                                  <p className="mt-1 text-xs text-red-400">
                                    {
                                      item.relatedViolations
                                    }{" "}
                                    active violation
                                    {item.relatedViolations !==
                                    1
                                      ? "s"
                                      : ""}{" "}
                                    linked
                                  </p>
                                )}

                              </div>

                              <span
                                className={`rounded-lg border px-3 py-2 text-xs font-bold ${getStatusClass(
                                  item.status
                                )}`}
                              >
                                {item.status ===
                                "Non-Compliant"
                                  ? "✕ Non-Compliant"
                                  : item.status ===
                                      "Compliant"
                                    ? "✓ Compliant"
                                    : "Pending"}
                              </span>

                            </div>

                          </div>
                        )
                      )}

                    </div>

                  </div>
                );
              }
            )}

          </div>
        )}

        {/* LIVE VIOLATION TABLE */}

        <div className="mt-8">

          <div className="mb-4 flex items-center justify-between">

            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                Backend Records
              </p>

              <h3 className="mt-1 text-lg font-bold text-white">
                Live Violations
              </h3>
            </div>

            <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs font-bold text-slate-400">
              {violations.length} Records
            </span>

          </div>

          {violations.length === 0 ? (

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-8 text-center">

              <p className="text-sm text-slate-500">
                No violations are currently stored
                in the SQLite backend.
              </p>

            </div>

          ) : (

            <div className="overflow-x-auto rounded-xl border border-slate-800">

              <table className="w-full min-w-[900px] text-left">

                <thead className="bg-black/30">

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
                      Location
                    </th>

                    <th className="px-4 py-3 text-xs uppercase tracking-wider text-slate-500">
                      Reported By
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {violations.map(
                    (violation) => {

                      const severity =
                        normalize(
                          violation.severity
                        );

                      const status =
                        normalize(
                          violation.status
                        );

                      return (
                        <tr
                          key={violation.id}
                          className="border-b border-slate-800"
                        >

                          <td className="px-4 py-4 font-mono text-xs text-slate-300">
                            #{violation.id}
                          </td>

                          <td className="px-4 py-4">

                            <p className="text-sm font-semibold text-white">
                              {violation.title}
                            </p>

                            {violation.description && (
                              <p className="mt-1 max-w-md text-xs text-slate-500">
                                {violation.description}
                              </p>
                            )}

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
                              {String(
                                violation.severity
                              ).toUpperCase()}
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
                            {violation.location_name ||
                              "Unknown"}
                          </td>

                          <td className="px-4 py-4 text-xs text-slate-400">
                            {violation.reported_by ||
                              "System"}
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

        {/* DATA FLOW */}

        <div className="mt-6 rounded-2xl border border-cyan-400/10 bg-cyan-400/5 p-4">

          <p className="text-xs font-bold uppercase tracking-widest text-cyan-400">
            CoalGuard Compliance Data Flow
          </p>

          <p className="mt-2 text-sm leading-7 text-slate-400">
            Field Inspection
            {" → "}
            Risk Engine
            {" → "}
            SQLite Violation
            {" → "}
            Compliance Assessment
            {" → "}
            Manager Escalation
            {" → "}
            Corrective Action
            {" → "}
            Verification
          </p>

        </div>

      </div>

    </section>
  );
}

export default ComplianceManagement;