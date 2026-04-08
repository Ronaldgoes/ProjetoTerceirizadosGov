/* global process */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function syncCusteioPlugin() {
  let isRunning = false;

  const handler = async (req, res) => {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: false, error: "Metodo nao permitido." }));
      return;
    }

    if (isRunning) {
      res.statusCode = 409;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: false, error: "Ja existe uma atualizacao em andamento." }));
      return;
    }

    isRunning = true;
    const npmCliPath =
      process.platform === "win32" && process.env.APPDATA
        ? `${process.env.APPDATA}\\npm\\npm.cmd`
        : null;
    const npmCommand = npmCliPath && existsSync(npmCliPath) ? npmCliPath : process.platform === "win32" ? "npm.cmd" : "npm";
    const child = spawn(npmCommand, ["run", "sync:custeio"], {
      cwd: process.cwd(),
      shell: process.platform === "win32",
    });

    let output = "";

    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });

    child.on("close", (code) => {
      isRunning = false;
      res.setHeader("Content-Type", "application/json");

      if (code === 0) {
        res.end(JSON.stringify({ ok: true, message: "Dados atualizados com sucesso.", output }));
        return;
      }

      res.statusCode = 500;
      res.end(JSON.stringify({ ok: false, error: "Falha ao atualizar os dados.", output }));
    });
  };

  return {
    name: "sync-custeio-plugin",
    configureServer(server) {
      server.middlewares.use("/api/sync-custeio", handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use("/api/sync-custeio", handler);
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), syncCusteioPlugin()],
});
