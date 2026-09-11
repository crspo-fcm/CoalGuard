import { spawn } from "node:child_process";

const isWindows = process.platform === "win32";

const backend = spawn(process.execPath, ["server/server.js"], {
  stdio: "inherit",
  env: process.env,
});

const frontend = isWindows
  ? spawn("cmd.exe", ["/d", "/s", "/c", "npm run dev:frontend"], {
      stdio: "inherit",
      env: process.env,
      windowsVerbatimArguments: false,
    })
  : spawn("npm", ["run", "dev:frontend"], {
      stdio: "inherit",
      env: process.env,
    });

const shutdown = () => {
  if (!backend.killed) backend.kill();
  if (!frontend.killed) frontend.kill();
};

process.on("SIGINT", () => {
  shutdown();
  process.exit(0);
});

process.on("SIGTERM", () => {
  shutdown();
  process.exit(0);
});

backend.on("exit", (code) => {
  if (code !== 0) {
    console.error(`Backend stopped with code ${code}`);
  }
});

frontend.on("exit", (code) => {
  if (code !== 0) {
    console.error(`Frontend stopped with code ${code}`);
  }
});