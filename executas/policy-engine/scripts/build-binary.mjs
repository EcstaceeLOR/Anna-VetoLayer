import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, chmodSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const executaDir = resolve(scriptDir, "..");
const repoDir = resolve(executaDir, "..", "..");
const packageJson = JSON.parse(readFileSync(join(executaDir, "package.json"), "utf8"));
const binaryBaseName = "anna-vetolayer-policy-engine";

const platformKeys = {
  darwin: { arm64: "darwin-arm64", x64: "darwin-x86_64" },
  linux: { x64: "linux-x86_64" },
  win32: { x64: "windows-x86_64" }
};

const platformKey = platformKeys[process.platform]?.[process.arch];
if (!platformKey) {
  throw new Error(`Unsupported release platform: ${process.platform}-${process.arch}`);
}

const stageDir = join(executaDir, "dist", "stage", packageJson.version, platformKey);
const buildDir = join(executaDir, "dist", "build", packageJson.version, platformKey);
const binDir = join(stageDir, "bin");
const binaryName = process.platform === "win32" ? `${binaryBaseName}.exe` : binaryBaseName;
const binaryPath = join(binDir, binaryName);
const blobPath = join(buildDir, "policy-engine.blob");
const seaConfigPath = join(buildDir, "sea-config.json");
const postjectCli = join(repoDir, "node_modules", "postject", "dist", "cli.js");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: executaDir,
    encoding: "utf8",
    ...options
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed\n${result.stdout || ""}\n${result.stderr || ""}`.trim());
  }
}

if (!existsSync(postjectCli)) {
  throw new Error("postject is missing. Run corepack pnpm install before building a release binary.");
}

const nodeBinary = readFileSync(process.execPath, "latin1");
const seaFuse = nodeBinary.match(/NODE_SEA_FUSE_[a-z0-9]+/i)?.[0];
if (!seaFuse) {
  throw new Error(`The Node runtime at ${process.execPath} does not expose a SEA sentinel fuse.`);
}

rmSync(stageDir, { recursive: true, force: true });
rmSync(buildDir, { recursive: true, force: true });
mkdirSync(binDir, { recursive: true });
mkdirSync(buildDir, { recursive: true });

const seaConfig = {
  main: join(executaDir, "policy-engine.js"),
  output: blobPath,
  disableExperimentalSEAWarning: true,
  useCodeCache: false,
  useSnapshot: false
};
writeFileSync(seaConfigPath, `${JSON.stringify(seaConfig, null, 2)}\n`);
run(process.execPath, [`--experimental-sea-config=${seaConfigPath}`]);

copyFileSync(process.execPath, binaryPath);
if (process.platform === "darwin") {
  run("codesign", ["--remove-signature", binaryPath]);
}

const postjectArgs = [
  binaryPath,
  "NODE_SEA_BLOB",
  blobPath,
  "--sentinel-fuse",
  seaFuse
];
if (process.platform === "darwin") postjectArgs.push("--macho-segment-name", "NODE_SEA");
run(process.execPath, [postjectCli, ...postjectArgs]);

if (process.platform !== "win32") chmodSync(binaryPath, 0o755);

const archiveManifest = {
  name: binaryBaseName,
  version: packageJson.version,
  runtime: {
    binary: {
      entrypoint: `bin/${binaryName}`,
      permissions: process.platform === "win32" ? {} : { [`bin/${binaryName}`]: 493 }
    }
  }
};
writeFileSync(join(stageDir, "manifest.json"), `${JSON.stringify(archiveManifest, null, 2)}\n`);

console.log(JSON.stringify({ platform: platformKey, binary: binaryPath, stage: stageDir }, null, 2));
