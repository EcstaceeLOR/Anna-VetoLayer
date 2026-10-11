import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const executaDir = resolve(scriptDir, "..");
const packageJson = JSON.parse(readFileSync(join(executaDir, "package.json"), "utf8"));
const platformKeys = {
  darwin: { arm64: "darwin-arm64", x64: "darwin-x86_64" },
  linux: { x64: "linux-x86_64" },
  win32: { x64: "windows-x86_64" }
};
const platformKey = platformKeys[process.platform]?.[process.arch];
if (!platformKey) throw new Error(`Unsupported release platform: ${process.platform}-${process.arch}`);

const distDir = join(executaDir, "dist");
const extension = process.platform === "win32" ? "zip" : "tar.gz";
const archivePath = join(distDir, `anna-vetolayer-policy-engine-${packageJson.version}-${platformKey}.${extension}`);
const extractDir = join(distDir, "verify", `${platformKey}-${process.pid}-${Date.now()}`);

if (!existsSync(archivePath)) throw new Error("Release archive is missing. Run package:executa first.");
mkdirSync(extractDir, { recursive: true });

let extract;
if (process.platform === "win32") {
  extract = spawnSync("unzip", ["-q", archivePath, "-d", extractDir], { encoding: "utf8" });
} else {
  extract = spawnSync("tar", ["-xzf", archivePath, "-C", extractDir], { encoding: "utf8" });
}
if (extract.error) throw extract.error;
if (extract.status !== 0) throw new Error(`Archive extraction failed\n${extract.stdout || ""}\n${extract.stderr || ""}`.trim());

const archiveManifest = JSON.parse(readFileSync(join(extractDir, "manifest.json"), "utf8"));
const entrypoint = archiveManifest?.runtime?.binary?.entrypoint;
if (typeof entrypoint !== "string" || !entrypoint.startsWith("bin/")) {
  throw new Error("Archive manifest is missing a valid runtime.binary.entrypoint.");
}
const binaryPath = join(extractDir, ...entrypoint.split("/"));
if (!existsSync(binaryPath)) throw new Error(`Archive entrypoint does not exist: ${entrypoint}`);

const requests = [
  { jsonrpc: "2.0", id: 1, method: "describe" },
  { jsonrpc: "2.0", id: 2, method: "health" },
  {
    jsonrpc: "2.0",
    id: 3,
    method: "invoke",
    params: {
      tool: "evaluate_action",
      arguments: {
        actor: "release-test",
        tool: "release-test",
        operation: "deploy",
        target: "staging-api",
        environment: "staging",
        impact: "code",
        summary: "Deploy a verified staging release with an approved rollback plan.",
        rollback_plan: "Re-deploy the last known good release."
      }
    }
  }
];

const frames = await new Promise((resolveFrames, rejectFrames) => {
  const child = spawn(binaryPath, [], { stdio: ["pipe", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  const timer = setTimeout(() => {
    child.kill();
    rejectFrames(new Error("Packaged Executa did not finish the smoke test within 15 seconds."));
  }, 15_000);
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  child.on("error", (error) => {
    clearTimeout(timer);
    rejectFrames(error);
  });
  child.on("close", (code) => {
    clearTimeout(timer);
    if (code !== 0) return rejectFrames(new Error(`Packaged Executa exited ${code}: ${stderr}`));
    try {
      resolveFrames(stdout.trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line)));
    } catch (error) {
      rejectFrames(error);
    }
  });
  child.stdin.end(`${requests.map((request) => JSON.stringify(request)).join("\n")}\n`);
});

if (frames.length !== 3) throw new Error(`Expected 3 JSON-RPC responses, received ${frames.length}.`);
if (frames[0]?.result?.name !== "anna-vetolayer-policy-engine") throw new Error("describe response is invalid.");
if (frames[1]?.result?.status !== "ready") throw new Error("health response is invalid.");
if (frames[2]?.result?.success !== true || !frames[2]?.result?.data?.receipt_id) {
  throw new Error("invoke response is invalid.");
}

console.log(JSON.stringify({ platform: platformKey, archive: archivePath, entrypoint, verified: true }, null, 2));
