"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function pngDimensions(file) {
  const bytes = fs.readFileSync(file);
  assert.equal(bytes.subarray(1, 4).toString("ascii"), "PNG");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), size: bytes.length };
}

test("Marketplace logo is an upload-ready 256px PNG under 2 MB", () => {
  const logo = pngDimensions(path.join(root, "assets", "marketplace", "anna-vetolayer-logo-256.png"));
  assert.deepEqual({ width: logo.width, height: logo.height }, { width: 256, height: 256 });
  assert.ok(logo.size < 2 * 1024 * 1024);
});

test("Marketplace cover is a wide PNG under 2 MB", () => {
  const cover = pngDimensions(path.join(root, "assets", "marketplace", "anna-vetolayer-cover.png"));
  assert.ok(cover.width > cover.height);
  assert.ok(cover.size < 2 * 1024 * 1024);
});

test("public privacy policy describes shared-review data and deletion", () => {
  const policy = fs.readFileSync(path.join(root, "privacy.html"), "utf8");
  assert.match(policy, /Clerk/);
  assert.match(policy, /Neon/);
  assert.match(policy, /Vercel/);
  assert.match(policy, /Retention and deletion/);
  assert.match(policy, /does not sell personal information/);
});
