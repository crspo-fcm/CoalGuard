import {
  useEffect,
  useMemo,
  useState
} from "react";

import {
  API_BASE_URL
} from "../api";


type ResolvedViolation = {

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


function formatDate(
  value?: string | null
) {

  if (!value) {
    return "—";
  }


  const date =
    new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return value;

  }


  return date.toLocaleString(
    "en-IN"
  );

}


function severityClass(
  severity?: string
) {

  const value =
    String(
      severity || ""
    ).toLowerCase();


  if (
    value.includes("critical")
  ) {

    return "border-red-500/30 bg-red-500/10 text-red-400";

  }


  if (
    value.includes("high")
  ) {

    return "border-orange-500/30 bg-orange-500/10 text-orange-400";

  }


  if (
    value.includes("medium") ||
    value.includes("moderate")
  ) {

    return "border-yellow-500/30 bg-yellow-500/10 text-yellow-400";

  }


  return "border-slate-600 bg-slate-800 text-slate-300";

}


export default function ResolvedRecords() {

  const [
    records,
    setRecords
  ] =
    useState<
      ResolvedViolation[]
    >([]);


  const [
    loading,
    setLoading
  ] =
    useState(true);


  const [
    error,
    setError
  ] =
    useState("");


  const [
    selectedId,
    setSelectedId
  ] =
    useState<
      number | null
    >(null);


  const [
    lastUpdated,
    setLastUpdated
  ] =
    useState("");


  /* =======================================================
     GET CURRENT USER
     ======================================================= */

  const user =
    useMemo(() => {

      try {

        const saved =
          sessionStorage.getItem(
            "coalguard_user"
          );


        return saved
          ? JSON.parse(saved)
          : null;

      } catch {

        return null;

      }

    }, []);


  const role =
    String(
      user?.role || ""
    ).toLowerCase();


  /* =======================================================
     LOAD RESOLVED RECORDS
     ======================================================= */

  const loadRecords =
    async () => {

      /*
       * Frontend protection.
       *
       * Backend protection is ALSO enabled,
       * so Inspector cannot access the endpoint
       * even by manually making a request.
       */

      if (
        role !== "manager" &&
        role !== "admin"
      ) {

        setLoading(false);

        setRecords([]);

        setError(
          "Access denied. Resolved Records are restricted to Manager and Admin users."
        );

        return;

      }


      try {

        setError("");


        const token =
          sessionStorage.getItem(
            "coalguard_token"
          );


        const response =
          await fetch(
            `${API_BASE_URL}/api/violations/resolved`,
            {
              headers:
                token
                  ? {
                      Authorization:
                        `Bearer ${token}`
                    }
                  : undefined
            }
          );


        const data =
          await response
            .json()
            .catch(
              () => ({})
            );


        if (!response.ok) {

          throw new Error(
            data.message ||
              "Failed to load resolved records."
          );

        }


        const violations =
          Array.isArray(
            data.violations
          )
            ? data.violations
            : [];


        const resolved =
          violations

            .filter(
              (
                item:
                  ResolvedViolation
              ) =>
                String(
                  item.status || ""
                ).toLowerCase() ===
                "resolved"
            )

            .sort(
              (
                a:
                  ResolvedViolation,

                b:
                  ResolvedViolation
              ) => {

                return (
                  new Date(
                    b.verified_at ||
                      b.created_at ||
                      ""
                  ).getTime()

                  -

                  new Date(
                    a.verified_at ||
                      a.created_at ||
                      ""
                  ).getTime()
                );

              }
            );


        setRecords(
          resolved
        );


        setLastUpdated(
          new Date().toLocaleTimeString(
            "en-IN"
          )
        );


      } catch (
        loadError
      ) {

        setError(

          loadError instanceof Error

            ? loadError.message

            : "Unable to load resolved records."

        );

      } finally {

        setLoading(false);

      }

    };


  /* =======================================================
     REFRESH
     ======================================================= */

  useEffect(() => {

    void loadRecords();


    const timer =
      window.setInterval(
        () =>
          void loadRecords(),
        5000
      );


    return () =>
      window.clearInterval(
        timer
      );

  }, [role]);


  /* =======================================================
     ACCESS DENIED
     ======================================================= */

  if (
    role !== "manager" &&
    role !== "admin"
  ) {

    return (

      <section className="mt-8 px-4 pb-10">

        <div className="mx-auto max-w-5xl rounded-2xl border border-red-500/30 bg-red-950/20 p-8">

          <p className="text-xs font-black uppercase tracking-[0.2em] text-red-400">

            Access Restricted

          </p>


          <h2 className="mt-2 text-2xl font-black text-white">

            Resolved Records

          </h2>


          <p className="mt-2 text-sm text-slate-400">

            This section is available only
            to Manager and Admin users.

          </p>

        </div>

      </section>

    );

  }


  /* =======================================================
     MAIN
     ======================================================= */

  return (

    <section className="mt-8 px-4 pb-12">

      <div className="mx-auto max-w-7xl">


        {/* HEADER */}

        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">

          <div>

            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">

              Governance Archive

            </p>


            <h2 className="mt-2 text-3xl font-black text-white">

              Resolved Records

            </h2>


            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">

              Historical violations that
              completed corrective action
              and verification.

              Available only to Manager
              and Admin users.

            </p>

          </div>


          <div className="text-right">

            <div className="inline-flex rounded-full border border-green-500/20 bg-green-500/10 px-3 py-1 text-xs font-bold text-green-400">

              ✓ VERIFIED HISTORY

            </div>


            <p className="mt-2 text-xs text-slate-500">

              {
                lastUpdated
                  ? `Updated ${lastUpdated}`
                  : "Loading..."
              }

            </p>

          </div>

        </div>


        {/* ERROR */}

        {error && (

          <div className="mb-5 rounded-xl border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-400">

            {error}

          </div>

        )}


        {/* =================================================
            KPI CARDS
        ================================================= */}

        <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">


          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">

            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">

              Resolved Records

            </p>


            <p className="mt-2 text-3xl font-black text-white">

              {records.length}

            </p>


            <p className="mt-1 text-xs text-slate-500">

              Permanent historical records

            </p>

          </div>


          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">

            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">

              Verified

            </p>


            <p className="mt-2 text-3xl font-black text-green-400">

              {
                records.filter(
                  record =>
                    Boolean(
                      record.verified_by
                    )
                ).length
              }

            </p>


            <p className="mt-1 text-xs text-slate-500">

              Records with verifier

            </p>

          </div>


          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">

            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">

              Access

            </p>


            <p className="mt-2 text-lg font-black text-white">

              {
                role === "admin"
                  ? "ADMIN"
                  : "MANAGER"
              }

            </p>


            <p className="mt-1 text-xs text-slate-500">

              Authorized role

            </p>

          </div>

        </div>


        {/* =================================================
            RESOLUTION HISTORY
        ================================================= */}

        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">


          <div className="border-b border-slate-800 px-5 py-4">

            <p className="text-sm font-bold text-white">

              Resolution History

            </p>


            <p className="mt-1 text-xs text-slate-500">

              Active violations are excluded
              from this archive.

            </p>

          </div>


          {/* LOADING */}

          {loading ? (

            <div className="p-8 text-center text-sm text-slate-500">

              Loading resolved records...

            </div>


          ) : records.length === 0 ? (

            /* EMPTY */

            <div className="p-8 text-center">

              <p className="text-sm font-semibold text-slate-300">

                No resolved records yet.

              </p>


              <p className="mt-1 text-xs text-slate-500">

                Records appear here after
                a violation is verified
                as resolved.

              </p>

            </div>


          ) : (

            /* RECORDS */

            <div className="divide-y divide-slate-800">

              {records.map(
                record => (

                  <div
                    key={record.id}
                    className="p-5"
                  >


                    {/* RECORD HEADER */}

                    <button
                      type="button"

                      onClick={() =>
                        setSelectedId(
                          selectedId ===
                            record.id
                            ? null
                            : record.id
                        )
                      }

                      className="w-full text-left"
                    >

                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">


                        <div>


                          <div className="flex flex-wrap items-center gap-2">


                            <span className="text-sm font-black text-white">

                              Violation #{record.id}

                            </span>


                            <span
                              className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${severityClass(record.severity)}`}
                            >

                              {
                                record.severity ||
                                "Unknown"
                              }

                            </span>


                            <span className="rounded-full border border-green-500/20 bg-green-500/10 px-2.5 py-1 text-[10px] font-black text-green-400">

                              RESOLVED

                            </span>

                          </div>


                          <p className="mt-2 text-sm font-semibold text-slate-200">

                            {record.title}

                          </p>


                          <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-500 md:grid-cols-3">


                            <span>

                              Mine:

                              {" "}

                              <strong className="text-slate-300">

                                {
                                  record.location_name ||
                                  "—"
                                }

                              </strong>

                            </span>


                            <span>

                              Inspector:

                              {" "}

                              <strong className="text-slate-300">

                                {
                                  record.inspector_name ||
                                  "—"
                                }

                              </strong>

                            </span>


                            <span>

                              Resolved:

                              {" "}

                              <strong className="text-slate-300">

                                {
                                  formatDate(
                                    record.verified_at
                                  )
                                }

                              </strong>

                            </span>

                          </div>

                        </div>


                        <span className="shrink-0 text-xs font-bold text-slate-500">

                          {
                            selectedId ===
                            record.id

                              ? "HIDE DETAILS ↑"

                              : "VIEW DETAILS →"
                          }

                        </span>

                      </div>

                    </button>


                    {/* =================================================
                        EXPANDED DETAILS
                    ================================================= */}

                    {
                      selectedId ===
                      record.id && (

                        <div className="mt-5 grid gap-4 border-t border-slate-800 pt-5 md:grid-cols-2">


                          <Detail

                            label="Original Observation"

                            value={
                              record.inspection_observation ||
                              record.description ||
                              "No observation recorded."
                            }

                          />


                          <Detail

                            label="Corrective Action"

                            value={
                              record.corrective_action ||
                              "No corrective action recorded."
                            }

                          />


                          <Detail

                            label="Resolution Note"

                            value={
                              record.resolution_note ||
                              "No resolution note recorded."
                            }

                          />


                          <Detail

                            label="Verification"

                            value={
                              `Verified by: ${
                                record.verified_by ||
                                "—"
                              }\nVerified at: ${
                                formatDate(
                                  record.verified_at
                                )
                              }`
                            }

                          />


                          <Detail

                            label="Assignment"

                            value={
                              `Assigned to: ${
                                record.assigned_to ||
                                "—"
                              }\nDue date: ${
                                formatDate(
                                  record.due_date
                                )
                              }`
                            }

                          />


                          <Detail

                            label="Audit Reference"

                            value={
                              `Inspection #${
                                record.inspection_id ??
                                "—"
                              }\nReported: ${
                                formatDate(
                                  record.created_at
                                )
                              }`
                            }

                          />

                        </div>

                      )
                    }

                  </div>

                )
              )}

            </div>

          )}

        </div>

      </div>

    </section>

  );

}


/* =========================================================
   DETAIL COMPONENT
   ========================================================= */

function Detail({

  label,

  value

}: {

  label: string;

  value: string;

}) {

  return (

    <div>

      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">

        {label}

      </p>


      <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-300">

        {value}

      </p>

    </div>

  );

}