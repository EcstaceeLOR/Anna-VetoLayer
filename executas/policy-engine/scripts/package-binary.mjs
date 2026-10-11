import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

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
const stageDir = join(distDir, "stage", platformKey);
const extension = process.platform === "win32" ? "zip" : "tar.gz";
const archivePath = join(distDir, `anna-vetolayer-policy-engine-${packageJson.version}-${platformKey}.${extension}`);
const quote = (value) => `'${value.replaceAll("'", "''")}'`;

if (!existsSync(join(stageDir, "manifest.json"))) {
  throw new Error("Release stage is missing. Run build:executa first.");
}

mkdirSync(distDir, { recursive: true });
rmSync(archivePath, { force: true });
rmSync(`${archivePath}.sha256`, { force: true });

let result;
if (process.platform === "win32") {
  const command = [
    "$ErrorActionPreference = 'Stop'",
    "Add-Type -AssemblyName System.IO.Compression",
    "Add-Type -AssemblyName System.IO.Compression.FileSystem",
    `$source = ${quote(stageDir)}`,
    `$destination = ${quote(archivePath)}`,
    "$archive = [System.IO.Compression.ZipFile]::Open($destination, [System.IO.Compression.ZipArchiveMode]::Create)",
    "try {",
    "  Get-ChildItem -LiteralPath $source -File -Recurse | ForEach-Object {",
    "    $relative = $_.FullName.Substring($source.Length).TrimStart('\\', '/') -replace '\\\\', '/'",
    "    $entry = $archive.CreateEntry($relative, [System.IO.Compression.CompressionLevel]::Optimal)",
    "    $entryStream = $entry.Open()",
    "    $inputStream = [System.IO.File]::OpenRead($_.FullName)",
    "    try { $inputStream.CopyTo($entryStream) } finally { $inputStream.Dispose(); $entryStream.Dispose() }",
    "  }",
    "} finally { $archive.Dispose() }"
  ].join("; ");
  result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], { encoding: "utf8" });
} else {
  result = spawnSync("tar", ["-czf", archivePath, "-C", stageDir, "."], { encoding: "utf8" });
}
if (result.error) throw result.error;
if (result.status !== 0) throw new Error(`Archive creation failed\n${result.stdout || ""}\n${result.stderr || ""}`.trim());

const sha256 = createHash("sha256").update(readFileSync(archivePath)).digest("hex");
writeFileSync(`${archivePath}.sha256`, `${sha256}  ${archivePath.split(/[\\/]/).pop()}\n`);
console.log(JSON.stringify({ platform: platformKey, archive: archivePath, sha256 }, null, 2));
