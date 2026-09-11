import {
  useEffect,
  useState,
  type FormEvent,
} from "react";

import InspectorMobileView from "./components/InspectorMobileView";
import ManagerDashboard from "./components/ManagerDashboard";
import AuthorityDashboard from "./components/AuthorityDashboard";

import {
  testBackend,
  API_BASE_URL,
} from "./api";

type UserRole =
  | "inspector"
  | "manager"
  | "admin";

type LoggedInUser = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
};

function App() {
  const [user, setUser] =
    useState<LoggedInUser | null>(() => {
      const savedUser =
        sessionStorage.getItem(
          "coalguard_user"
        );

      if (!savedUser) {
        return null;
      }

      try {
        return JSON.parse(
          savedUser
        ) as LoggedInUser;
      } catch {
        sessionStorage.removeItem(
          "coalguard_user"
        );

        return null;
      }
    });

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [selectedRole, setSelectedRole] =
    useState<UserRole>("inspector");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [backendOnline, setBackendOnline] =
    useState(false);

  /* =========================================================
     BACKEND CONNECTION TEST
  ========================================================= */

  useEffect(() => {
    let active = true;

    testBackend()
      .then((data) => {
        console.log(
          "BACKEND CONNECTED:",
          data
        );

        if (active) {
          setBackendOnline(true);
        }
      })
      .catch((error) => {
        console.error(
          "BACKEND CONNECTION FAILED:",
          error
        );

        if (active) {
          setBackendOnline(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  /* =========================================================
     LOGIN
  ========================================================= */

  const handleLogin = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setError("");

    if (
      !email.trim() ||
      !password
    ) {
      setError(
        "Please enter your email and password."
      );

      return;
    }

    if (!backendOnline) {
      setError(
        "Backend is currently unavailable. Please try again."
      );

      return;
    }

    setLoading(true);

    try {
      /*
       * IMPORTANT:
       * Production login goes directly to Render.
       *
       * https://coalguard.onrender.com/api/auth/login
       */

      const response = await fetch(
        `${API_BASE_URL}/api/auth/login`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            email: email.trim(),
            password,
          }),
        }
      );

      /*
       * Don't blindly call response.json()
       * if the server sends HTML or an empty response.
       */

      const contentType =
        response.headers.get(
          "content-type"
        ) || "";

      if (
        !contentType.includes(
          "application/json"
        )
      ) {
        throw new Error(
          `Login server returned an invalid response (${response.status}).`
        );
      }

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ||
            "Login failed."
        );
      }

      if (!data.user) {
        throw new Error(
          "Login succeeded but user information was not returned."
        );
      }

      const loggedInUser: LoggedInUser =
        {
          id: Number(
            data.user.id
          ),

          name: String(
            data.user.name ||
              "CoalGuard User"
          ),

          email: String(
            data.user.email ||
              email.trim()
          ),

          role: String(
            data.user.role
          ).toLowerCase() as UserRole,
        };

      /* =====================================================
         ROLE VALIDATION
      ===================================================== */

      if (
        loggedInUser.role !==
        selectedRole
      ) {
        throw new Error(
          `This account is registered as ${formatRole(
            loggedInUser.role
          )}. Please select the correct role.`
        );
      }

      /* =====================================================
         SAVE SESSION
      ===================================================== */

      if (data.token) {
        sessionStorage.setItem(
          "coalguard_token",
          String(data.token)
        );
      }

      sessionStorage.setItem(
        "coalguard_user",
        JSON.stringify(
          loggedInUser
        )
      );

      setUser(loggedInUser);

      setEmail("");
      setPassword("");
      setError("");

    } catch (loginError) {
      console.error(
        "LOGIN ERROR:",
        loginError
      );

      setError(
        loginError instanceof Error
          ? loginError.message
          : "Unable to login."
      );
    } finally {
      setLoading(false);
    }
  };

  /* =========================================================
     LOGOUT
  ========================================================= */

  const handleLogout = () => {
    sessionStorage.removeItem(
      "coalguard_token"
    );

    sessionStorage.removeItem(
      "coalguard_user"
    );

    setUser(null);
    setError("");
    setPassword("");
  };

  /* =========================================================
     LOGGED-IN APPLICATION
  ========================================================= */

  if (user) {
    return (
      <div className="cg-app">

        <div className="cg-topline" />

        <header className="cg-header">
          <div className="cg-header-inner">

            {/* LOGO */}

            <div className="cg-logo">

              <div className="cg-logo-mark">
                CG
              </div>

              <div>
                <p className="cg-logo-title">
                  CoalGuard
                </p>

                <p className="cg-logo-subtitle">
                  Mine Governance &
                  Compliance
                </p>
              </div>

            </div>

            {/* USER INFORMATION */}

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >

              <div
                style={{
                  textAlign: "right",
                }}
              >

                <p
                  style={{
                    margin: 0,
                    fontSize: "12px",
                    fontWeight: 700,
                    color:
                      "var(--cg-text)",
                  }}
                >
                  {user.name}
                </p>

                <p
                  style={{
                    margin: 0,
                    fontSize: "9px",
                    color:
                      "var(--cg-text-secondary)",
                    textTransform:
                      "uppercase",
                    letterSpacing:
                      "0.08em",
                  }}
                >
                  {formatRole(
                    user.role
                  )}
                </p>

              </div>

              <button
                type="button"
                onClick={
                  handleLogout
                }
                className="cg-role-button"
              >
                Logout
              </button>

            </div>

          </div>
        </header>

        <main>

          {/* INSPECTOR */}

          {user.role ===
            "inspector" && (
            <InspectorMobileView />
          )}

          {/* MANAGER */}

          {user.role ===
            "manager" && (
            <ManagerDashboard />
          )}

          {/* AUTHORITY */}

          {user.role ===
            "admin" && (
            <AuthorityDashboard />
          )}

        </main>

      </div>
    );
  }

  /* =========================================================
     LOGIN SCREEN
  ========================================================= */

  return (
    <div className="cg-app">

      <div className="cg-topline" />

      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
        }}
      >

        <div
          style={{
            width: "100%",
            maxWidth: "520px",
          }}
        >

          {/* BRAND */}

          <div
            style={{
              textAlign: "center",
              marginBottom: "28px",
            }}
          >

            <div
              style={{
                display:
                  "inline-flex",
                alignItems:
                  "center",
                gap: "12px",
              }}
            >

              <div className="cg-logo-mark">
                CG
              </div>

              <div
                style={{
                  textAlign: "left",
                }}
              >

                <p className="cg-logo-title">
                  CoalGuard
                </p>

                <p className="cg-logo-subtitle">
                  Mine Governance &
                  Compliance
                </p>

              </div>

            </div>

          </div>

          {/* LOGIN CARD */}

          <section className="cg-panel">

            <div className="cg-panel-body">

              <p className="cg-accent-text">
                SECURE ACCESS
              </p>

              <h1
                className="cg-section-title"
                style={{
                  marginTop: "6px",
                }}
              >
                Welcome to CoalGuard
              </h1>

              <p
                className="cg-muted"
                style={{
                  marginTop: "8px",
                }}
              >
                Sign in to access your
                mine governance
                workspace.
              </p>

              {/* BACKEND STATUS */}

              <div
                style={{
                  marginTop: "18px",
                  padding:
                    "10px 12px",
                  border:
                    "1px solid var(--cg-border)",
                  background:
                    "var(--cg-surface)",
                  display: "flex",
                  alignItems:
                    "center",
                  gap: "8px",
                }}
              >

                <span
                  style={{
                    width: "7px",
                    height: "7px",
                    borderRadius:
                      "50%",
                    background:
                      backendOnline
                        ? "var(--cg-success)"
                        : "#ef4444",
                  }}
                />

                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    textTransform:
                      "uppercase",
                    letterSpacing:
                      "0.08em",
                    color:
                      "var(--cg-text-secondary)",
                  }}
                >
                  {backendOnline
                    ? "Backend Connected"
                    : "Backend Offline"}
                </span>

              </div>

              {/* ROLE SELECTION */}

              <div
                style={{
                  marginTop: "24px",
                }}
              >

                <label
                  style={{
                    display:
                      "block",
                    marginBottom:
                      "9px",
                    fontSize: "10px",
                    fontWeight: 700,
                    textTransform:
                      "uppercase",
                    letterSpacing:
                      "0.08em",
                    color:
                      "var(--cg-text-secondary)",
                  }}
                >
                  Select your role
                </label>

                <div
                  className="cg-role-switch"
                  style={{
                    width: "100%",
                  }}
                >

                  {/* INSPECTOR */}

                  <button
                    type="button"
                    className={`cg-role-button ${
                      selectedRole ===
                      "inspector"
                        ? "active"
                        : ""
                    }`}
                    onClick={() =>
                      setSelectedRole(
                        "inspector"
                      )
                    }
                    style={{
                      flex: 1,
                    }}
                  >
                    👷 Inspector
                  </button>

                  {/* MANAGER */}

                  <button
                    type="button"
                    className={`cg-role-button ${
                      selectedRole ===
                      "manager"
                        ? "active"
                        : ""
                    }`}
                    onClick={() =>
                      setSelectedRole(
                        "manager"
                      )
                    }
                    style={{
                      flex: 1,
                    }}
                  >
                    👔 Manager
                  </button>

                  {/* AUTHORITY */}

                  <button
                    type="button"
                    className={`cg-role-button ${
                      selectedRole ===
                      "admin"
                        ? "active"
                        : ""
                    }`}
                    onClick={() =>
                      setSelectedRole(
                        "admin"
                      )
                    }
                    style={{
                      flex: 1,
                    }}
                  >
                    🏛️ Authority
                  </button>

                </div>

                <p
                  style={{
                    marginTop: "9px",
                    fontSize: "11px",
                    color:
                      "var(--cg-text-secondary)",
                  }}
                >
                  {getRoleDescription(
                    selectedRole
                  )}
                </p>

              </div>

              {/* LOGIN FORM */}

              <form
                onSubmit={
                  handleLogin
                }
                style={{
                  marginTop: "22px",
                }}
              >

                {/* EMAIL */}

                <div>

                  <label
                    htmlFor="coalguard-email"
                    style={{
                      display:
                        "block",
                      marginBottom:
                        "7px",
                      fontSize: "10px",
                      fontWeight: 700,
                      textTransform:
                        "uppercase",
                      letterSpacing:
                        "0.08em",
                      color:
                        "var(--cg-text-secondary)",
                    }}
                  >
                    Email
                  </label>

                  <input
                    id="coalguard-email"
                    type="email"
                    value={email}
                    onChange={(
                      event
                    ) =>
                      setEmail(
                        event.target
                          .value
                      )
                    }
                    placeholder="Enter your email"
                    autoComplete="email"
                    style={{
                      width: "100%",
                      boxSizing:
                        "border-box",
                      padding:
                        "12px 13px",
                      border:
                        "1px solid var(--cg-border)",
                      background:
                        "var(--cg-bg)",
                      color:
                        "var(--cg-text)",
                      outline:
                        "none",
                    }}
                  />

                </div>

                {/* PASSWORD */}

                <div
                  style={{
                    marginTop: "16px",
                  }}
                >

                  <label
                    htmlFor="coalguard-password"
                    style={{
                      display:
                        "block",
                      marginBottom:
                        "7px",
                      fontSize: "10px",
                      fontWeight: 700,
                      textTransform:
                        "uppercase",
                      letterSpacing:
                        "0.08em",
                      color:
                        "var(--cg-text-secondary)",
                    }}
                  >
                    Password
                  </label>

                  <input
                    id="coalguard-password"
                    type="password"
                    value={password}
                    onChange={(
                      event
                    ) =>
                      setPassword(
                        event.target
                          .value
                      )
                    }
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    style={{
                      width: "100%",
                      boxSizing:
                        "border-box",
                      padding:
                        "12px 13px",
                      border:
                        "1px solid var(--cg-border)",
                      background:
                        "var(--cg-bg)",
                      color:
                        "var(--cg-text)",
                      outline:
                        "none",
                    }}
                  />

                </div>

                {/* ERROR */}

                {error && (
                  <div
                    style={{
                      marginTop:
                        "16px",
                      padding:
                        "11px 13px",
                      border:
                        "1px solid rgba(239,68,68,.35)",
                      background:
                        "rgba(127,29,29,.15)",
                      color:
                        "#f87171",
                      fontSize:
                        "12px",
                    }}
                  >
                    {error}
                  </div>
                )}

                {/* SUBMIT */}

                <button
                  type="submit"
                  disabled={loading}
                  className="cg-button cg-button-primary"
                  style={{
                    width: "100%",
                    marginTop:
                      "20px",
                    opacity:
                      loading
                        ? 0.65
                        : 1,
                  }}
                >
                  {loading
                    ? "AUTHENTICATING..."
                    : "SIGN IN →"}
                </button>

              </form>

              {/* SECURITY NOTE */}

              <div
                style={{
                  marginTop: "20px",
                  paddingTop:
                    "16px",
                  borderTop:
                    "1px solid var(--cg-border)",
                }}
              >

                <p
                  style={{
                    margin: 0,
                    fontSize: "10px",
                    lineHeight: 1.6,
                    color:
                      "var(--cg-text-secondary)",
                  }}
                >
                  🔐 Secure authentication
                  powered by CoalGuard
                  backend services.
                </p>

              </div>

            </div>

          </section>

        </div>

      </main>

    </div>
  );
}

/* =========================================================
   ROLE HELPERS
========================================================= */

function formatRole(
  role: UserRole
): string {

  switch (role) {

    case "inspector":
      return "Field Inspector";

    case "manager":
      return "Mine Manager";

    case "admin":
      return "Authority / Admin";

    default:
      return "User";
  }
}

function getRoleDescription(
  role: UserRole
): string {

  switch (role) {

    case "inspector":
      return "Conduct field inspections and submit verified observations.";

    case "manager":
      return "Monitor compliance, violations, risk and mine operations.";

    case "admin":
      return "Review governance-level information and system activity.";

    default:
      return "";
  }
}

export default App;