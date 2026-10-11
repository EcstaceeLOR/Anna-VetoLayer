"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "bundle", "index.html"), "utf8");
const appJs = fs.readFileSync(path.join(root, "bundle", "app.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "bundle", "styles.css"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const app = JSON.parse(fs.readFileSync(path.join(root, "app.json"), "utf8"));
const executa = JSON.parse(
  fs.readFileSync(path.join(root, app.bundled_executas["policy-engine"].path, "executa.json"), "utf8")
);

test("every DOM id used by app.js exists exactly once", () => {
  const referenced = [...appJs.matchAll(/\$\("([a-z0-9-]+)"\)/g)].map((match) => match[1]);
  for (const id of new Set(referenced)) {
    const matches = html.match(new RegExp(`id=["']${id}["']`, "g")) || [];
    assert.equal(matches.length, 1, `expected one #${id}, found ${matches.length}`);
  }
});

test("HTML ids are unique", () => {
  const ids = [...html.matchAll(/\sid=["']([^"']+)["']/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length);
});

test("bundle and Executa handles resolve", () => {
  assert.equal(manifest.ui.bundle.entry, "index.html");
  assert.ok(fs.existsSync(path.join(root, "bundle", manifest.ui.bundle.entry)));
  const handle = manifest.required_executas[0].tool_id.replace("bundled:", "");
  assert.ok(app.bundled_executas[handle]);
  assert.ok(fs.existsSync(path.join(root, app.bundled_executas[handle].path, "executa.json")));
  assert.ok(manifest.ui.host_api.tools.includes("required:*"));
});

test("Policy Engine has a complete binary release profile", () => {
  assert.equal(executa.distribution.active, "binary");
  const artifacts = executa.distribution.profiles.binary.binary_artifacts;
  assert.deepEqual(Object.keys(artifacts).sort(), [
    "darwin-arm64",
    "darwin-x86_64",
    "linux-x86_64",
    "windows-x86_64"
  ]);
  for (const [platform, artifact] of Object.entries(artifacts)) {
    assert.match(artifact.path, /dist\/anna-vetolayer-policy-engine-\{version\}-.+/);
    assert.ok(artifact.entrypoint.startsWith("bin/"), `${platform} needs an archive entrypoint`);
  }
});

test("bundle uses external scripts only", () => {
  const scriptTags = [...html.matchAll(/<script\b([^>]*)>/gi)].map((match) => match[1]);
  assert.ok(scriptTags.length >= 2);
  assert.ok(scriptTags.every((attributes) => /\bsrc=/.test(attributes)));
});

test("mobile bundle leaves viewport ownership to Anna and respects shell safe areas", () => {
  assert.doesNotMatch(html, /<meta\s+name=["']viewport["']/i);
  for (const edge of ["top", "right", "bottom", "left"]) {
    assert.match(styles, new RegExp(`safe-area-inset-${edge}`));
  }
  assert.match(styles, /min-height:\s*44px/);
  assert.doesNotMatch(appJs, /\b(?:innerWidth|innerHeight|visualViewport|resizeTo|moveTo)\b/);
});
