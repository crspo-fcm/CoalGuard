import { useEffect, useState } from "react";
import { API_BASE_URL } from "../api"; 
type AuditLog = {
  id: number;
  inspection_id: number | null;
  violation_id: number | null;
  action: string;
  actor: string;
  description: string | null;
  timestamp: string;
  previous_hash: string | null;
  hash: string | null;
};

type AuditStats = {
  total: number;
  violation_actions: number;
  inspection_actions: number;
  resolved: number;
};

function AuditLedger() {
  const [logs, setLogs] = useState<AuditLog[]>([]);

  const [stats, setStats] = useState<AuditStats>({
    total: 0,
    violation_actions: 0,
    inspection_actions: 0,
    resolved: 0,
  });

  const [verificationStatus, setVerificationStatus] = useState<
    "Not Checked" | "Verified" | "Tamper Detected"
  >("Not Checked");

  const [isLoading, setIsLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState("");

  const [selectedLog, setSelectedLog] = useState<number | null>(null);

  /* =====================================================
     LOAD AUDIT LOGS FROM SQLITE BACKEND
  ===================================================== */

  const loadAuditLogs = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/audit`);

      if (!response.ok) {
        throw new Error("Failed to load audit logs");
      }

      const data = await response.json();

      setLogs(
        Array.isArray(data.logs)
          ? data.logs
          : []
      );

      setError("");
    } catch (error) {
      console.error("Audit log error:", error);
      setError("Backend audit feed unavailable.");
    } finally {
      setIsLoading(false);
    }
  };

  /* =====================================================
     LOAD AUDIT STATISTICS
  ===================================================== */

  const loadStats = async () => {
    try {
      const response = await fetch(
        "/api/audit/stats"
      );

      if (!response.ok) {
        throw new Error(
          "Failed to load audit statistics"
        );
      }

      const data = await response.json();

      if (data.stats) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error(
        "Audit stats error:",
        error
      );
    }
  };

  /* =====================================================
     LIVE REFRESH
  ===================================================== */

  useEffect(() => {
    loadAuditLogs();
    loadStats();

    const interval = window.setInterval(() => {
      loadAuditLogs();
      loadStats();
    }, 3000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  /* =====================================================
     VERIFY BACKEND SHA-256 CHAIN
  ===================================================== */

  const verifyLedger = async () => {
    setIsVerifying(true);
    setVerificationStatus("Not Checked");

    try {
      const response = await fetch(
        "/api/audit/verify"
      );

      if (!response.ok) {
        throw new Error(
          "Verification request failed"
        );
      }

      const data = await response.json();

      if (data.valid === true) {
        setVerificationStatus("Verified");
      } else {
        setVerificationStatus(
          "Tamper Detected"
        );
      }
    } catch (error) {
      console.error(
        "Audit verification error:",
        error
      );

      setVerificationStatus(
        "Tamper Detected"
      );
    } finally {
      setIsVerifying(false);
    }
  };

  /* =====================================================
     FORMAT ACTION NAME
  ===================================================== */

  const formatAction = (action: string) => {
    return action
      .replaceAll("_", " ")
      .replace(
        /\b\w/g,
        (letter) => letter.toUpperCase()
      );
  };

  /* =====================================================
     ACTION STYLE
  ===================================================== */

  const getActionClass = (
    action: string
  ) => {
    if (action.includes("RESOLVED")) {
      return "bg-green-500/10 text-green-400";
    }

    if (
      action.includes("VIOLATION") ||
      action.includes("CORRECTIVE") ||
      action.includes("STATUS")
    ) {
      return "bg-red-500/10 text-red-400";
    }

    if (action.includes("INSPECTION")) {
      return "bg-blue-500/10 text-blue-400";
    }

    return "bg-slate-500/10 text-slate-400";
  };

  return (
    <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Security & Accountability
          </p>

          <h2 className="mt-2 text-2xl font-bold text-white">
            🔐 Audit Ledger
          </h2>

          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Backend audit history secured with
            SHA-256 hash chaining.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">

          <span className="rounded-xl border border-blue-800/60 bg-blue-950/30 px-4 py-2 text-xs font-bold text-blue-400">
            ● SQLITE BACKEND
          </span>

          <button
            onClick={verifyLedger}
            disabled={isVerifying}
            className="rounded-xl border border-green-800 bg-green-950/40 px-4 py-2 text-sm font-semibold text-green-400 transition hover:bg-green-900/40 disabled:opacity-50"
          >
            {isVerifying
              ? "Verifying..."
              : "✓ Verify Chain"}
          </button>

        </div>
      </div>

      {/* =================================================
          ERROR
      ================================================= */}

      {error && (
        <div className="mt-5 rounded-xl border border-yellow-800/60 bg-yellow-950/20 p-4">

          <p className="text-sm font-semibold text-yellow-400">
            ⚠ Backend Connection
          </p>

          <p className="mt-1 text-xs text-yellow-500/80">
            {error}
          </p>

        </div>
      )}

      {/* =================================================
          VERIFICATION STATUS
      ================================================= */}

      <div className="mt-6">

        {verificationStatus ===
          "Verified" && (
          <div className="rounded-xl border border-green-800 bg-green-950/30 p-4">

            <div className="flex items-center gap-3">

              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10 text-xl">
                ✓
              </div>

              <div>

                <p className="font-bold text-green-400">
                  AUDIT CHAIN VERIFIED
                </p>

                <p className="text-xs text-slate-400">
                  All backend audit records
                  and hash links are valid.
                </p>

              </div>

            </div>

          </div>
        )}

        {verificationStatus ===
          "Tamper Detected" && (
          <div className="rounded-xl border border-red-800 bg-red-950/30 p-4">

            <div className="flex items-center gap-3">

              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10 text-xl">
                !
              </div>

              <div>

                <p className="font-bold text-red-400">
                  TAMPER DETECTED
                </p>

                <p className="text-xs text-slate-400">
                  The backend audit chain
                  failed cryptographic
                  verification.
                </p>

              </div>

            </div>

          </div>
        )}

        {verificationStatus ===
          "Not Checked" && (
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">

            <p className="text-sm font-semibold text-slate-300">
              Audit verification pending
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Click "Verify Chain" to
              validate the SQLite
              SHA-256 audit chain.
            </p>

          </div>
        )}

      </div>

      {/* =================================================
          LIVE STATUS
      ================================================= */}

      <div className="mt-5 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 px-4 py-3">

        <div>

          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Live Backend Feed
          </p>

          <p className="mt-1 text-xs text-slate-600">
            Automatically refreshed every
            3 seconds
          </p>

        </div>

        <div className="flex items-center gap-2">

          <span className="h-2 w-2 animate-pulse rounded-full bg-green-400" />

          <span className="text-xs font-bold text-green-400">
            LIVE
          </span>

        </div>

      </div>

      {/* =================================================
          STATISTICS
      ================================================= */}

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">

        <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">

          <p className="text-xs text-slate-500">
            Total Audit Records
          </p>

          <p className="mt-2 text-2xl font-bold text-white">
            {stats.total}
          </p>

        </div>

        <div className="rounded-xl border border-blue-900/60 bg-blue-950/20 p-4">

          <p className="text-xs text-blue-400">
            Inspection Actions
          </p>

          <p className="mt-2 text-2xl font-bold text-blue-400">
            {stats.inspection_actions}
          </p>

        </div>

        <div className="rounded-xl border border-red-900/60 bg-red-950/20 p-4">

          <p className="text-xs text-red-400">
            Violation Actions
          </p>

          <p className="mt-2 text-2xl font-bold text-red-400">
            {stats.violation_actions}
          </p>

        </div>

        <div className="rounded-xl border border-green-900/60 bg-green-950/20 p-4">

          <p className="text-xs text-green-400">
            Resolved
          </p>

          <p className="mt-2 text-2xl font-bold text-green-400">
            {stats.resolved}
          </p>

        </div>

      </div>

      {/* =================================================
          AUDIT TABLE
      ================================================= */}

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-800">

        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-4 py-3">

          <div>

            <h3 className="text-sm font-semibold text-slate-300">
              Immutable Backend Audit Chain
            </h3>

            <p className="mt-1 text-xs text-slate-600">
              Records stored in SQLite
              audit_logs
            </p>

          </div>

          <span className="rounded-lg border border-slate-700 px-3 py-1 text-xs font-mono text-slate-500">
            {logs.length} RECORDS
          </span>

        </div>

        {isLoading ? (
          <div className="p-10 text-center">

            <p className="text-sm text-slate-400">
              Loading backend audit
              records...
            </p>

          </div>
        ) : logs.length === 0 ? (
          <div className="p-10 text-center">

            <div className="text-3xl">
              🔐
            </div>

            <p className="mt-3 text-sm font-semibold text-slate-400">
              No backend audit records
              yet
            </p>

            <p className="mt-1 text-xs text-slate-600">
              Create or update a violation
              to generate an audit record.
            </p>

          </div>
        ) : (
          <div className="overflow-x-auto">

            <table className="w-full min-w-[1000px] text-left">

              <thead className="bg-slate-950">

                <tr className="border-b border-slate-800">

                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    ID
                  </th>

                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Time
                  </th>

                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Action
                  </th>

                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Actor
                  </th>

                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Reference
                  </th>

                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Hash
                  </th>

                </tr>

              </thead>

              <tbody>

                {logs.map((log) => {

                  const selected =
                    selectedLog === log.id;

                  return (
                    <tr
                      key={log.id}
                      onClick={() =>
                        setSelectedLog(
                          selected
                            ? null
                            : log.id
                        )
                      }
                      className="cursor-pointer border-b border-slate-800 transition hover:bg-slate-800/50"
                    >

                      <td className="px-4 py-4">

                        <span className="font-mono text-xs text-slate-300">
                          AUD-{log.id}
                        </span>

                      </td>

                      <td className="px-4 py-4">

                        <span className="text-xs text-slate-400">
                          {new Date(
                            log.timestamp
                          ).toLocaleString()}
                        </span>

                      </td>

                      <td className="px-4 py-4">

                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${getActionClass(
                            log.action
                          )}`}
                        >
                          {formatAction(
                            log.action
                          )}
                        </span>

                      </td>

                      <td className="px-4 py-4">

                        <span className="text-xs text-slate-400">
                          {log.actor}
                        </span>

                      </td>

                      <td className="px-4 py-4">

                        <div className="space-y-1">

                          {log.inspection_id && (
                            <p className="text-xs text-blue-400">
                              Inspection #
                              {log.inspection_id}
                            </p>
                          )}

                          {log.violation_id && (
                            <p className="text-xs text-red-400">
                              Violation #
                              {log.violation_id}
                            </p>
                          )}

                        </div>

                      </td>

                      <td className="px-4 py-4">

                        <span className="font-mono text-xs text-green-400">
                          {log.hash
                            ? `${log.hash.slice(
                                0,
                                18
                              )}...`
                            : "N/A"}
                        </span>

                      </td>

                    </tr>
                  );
                })}

              </tbody>

            </table>

          </div>
        )}

      </div>

      {/* =================================================
          SELECTED RECORD DETAILS
      ================================================= */}

      {selectedLog !== null && (

        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-5">

          {logs
            .filter(
              (log) =>
                log.id === selectedLog
            )
            .map((log) => (

              <div key={log.id}>

                <div className="flex items-center justify-between">

                  <h3 className="font-bold text-white">
                    Audit Record Details
                  </h3>

                  <span className="text-xs font-bold text-green-400">
                    SHA-256
                  </span>

                </div>

                <div className="mt-5 grid gap-5 md:grid-cols-2">

                  <div>

                    <p className="text-xs text-slate-600">
                      AUDIT ID
                    </p>

                    <p className="mt-1 font-mono text-xs text-slate-300">
                      AUD-{log.id}
                    </p>

                  </div>

                  <div>

                    <p className="text-xs text-slate-600">
                      ACTOR
                    </p>

                    <p className="mt-1 text-sm text-slate-400">
                      {log.actor}
                    </p>

                  </div>

                  <div>

                    <p className="text-xs text-slate-600">
                      ACTION
                    </p>

                    <p className="mt-1 text-sm font-semibold text-slate-300">
                      {formatAction(
                        log.action
                      )}
                    </p>

                  </div>

                  <div>

                    <p className="text-xs text-slate-600">
                      TIMESTAMP
                    </p>

                    <p className="mt-1 text-sm text-slate-400">
                      {new Date(
                        log.timestamp
                      ).toLocaleString()}
                    </p>

                  </div>

                  <div className="md:col-span-2">

                    <p className="text-xs text-slate-600">
                      DESCRIPTION
                    </p>

                    <p className="mt-1 text-sm text-slate-400">
                      {log.description ||
                        "No description provided."}
                    </p>

                  </div>

                  <div className="md:col-span-2">

                    <p className="text-xs text-slate-600">
                      PREVIOUS HASH
                    </p>

                    <p className="mt-1 break-all font-mono text-xs text-slate-500">
                      {log.previous_hash ||
                        "GENESIS"}
                    </p>

                  </div>

                  <div className="md:col-span-2">

                    <p className="text-xs text-slate-600">
                      SHA-256 HASH
                    </p>

                    <p className="mt-1 break-all font-mono text-xs text-green-400">
                      {log.hash || "N/A"}
                    </p>

                  </div>

                </div>

              </div>

            ))}

        </div>
      )}

      {/* =================================================
          SECURITY NOTE
      ================================================= */}

      <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950 p-4">

        <p className="text-xs font-semibold text-slate-400">
          🔒 Backend Audit Integrity
        </p>

        <p className="mt-1 text-xs leading-5 text-slate-600">
          Every violation workflow action
          creates a backend audit record.
          Each record stores its SHA-256
          hash and the hash of the preceding
          record, allowing the chain to be
          verified for unauthorized
          modification.
        </p>

      </div>

    </section>
  );
}

export default AuditLedger;