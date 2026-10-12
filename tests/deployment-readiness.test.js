const assert = require("node:assert/strict");
const { test } = require("node:test");
const { readFile } = require("node:fs/promises");
const { resolve } = require("node:path");

test("review schema migration preserves every complete statement", async () => {
  const { splitSqlStatements } = await import("../scripts/migrate-review-service.mjs");
  const schema = await readFile(resolve(__dirname, "../review-service/schema.sql"), "utf8");
  const statements = splitSqlStatements(schema);

  assert.equal(statements.length, 11);
  assert.match(statements[0], /^CREATE EXTENSION/);
  assert.match(statements.at(-1), /^CREATE INDEX/);
  assert.ok(statements.every((statement) => !statement.endsWith(";")));
});

test("authenticated API requires an explicit Clerk authorized-party allowlist", async () => {
  const authSource = await readFile(resolve(__dirname, "../api/_lib/auth.mjs"), "utf8");
  assert.match(authSource, /if \(!authorizedParties\.length\)/);
  assert.match(authSource, /verifyToken\(token, \{ secretKey: process\.env\.CLERK_SECRET_KEY, authorizedParties \}\)/);
});

test("health endpoint reports missing configuration without exposing values", async () => {
  const { default: health } = await import("../api/health.mjs");
  const names = ["DATABASE_URL", "CLERK_SECRET_KEY", "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "REVIEW_ALLOWED_ORIGINS", "REVIEW_AUTHORIZED_PARTIES"];
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  for (const name of names) delete process.env[name];

  let result;
  const response = {
    setHeader() {},
    status(code) {
      result = { code };
      return this;
    },
    json(body) {
      result.body = body;
      return this;
    }
  };

  try {
    await health({ method: "GET", headers: {} }, response);
    assert.deepEqual(result, { code: 503, body: { status: "misconfigured", missing: names } });
  } finally {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
});

test("review portal bootstrap creates exactly one default team and first admin", async () => {
  const source = await readFile(resolve(__dirname, "../api/bootstrap.mjs"), "utf8");
  assert.match(source, /ON CONFLICT \(slug\) DO NOTHING/);
  assert.match(source, /SELECT id, \$\{userId\}, 'admin' FROM team/);
  assert.match(source, /statusCode: 409/);
});

test("reviewer portal exposes only the Clerk publishable key", async () => {
  const source = await readFile(resolve(__dirname, "../api/config.mjs"), "utf8");
  assert.match(source, /NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY/);
  assert.doesNotMatch(source, /CLERK_SECRET_KEY|DATABASE_URL/);
});

test("public landing page sends visitors to the preview and reviewer portal", async () => {
  const html = await readFile(resolve(__dirname, "../index.html"), "utf8");
  const styles = await readFile(resolve(__dirname, "../landing.css"), "utf8");
  assert.match(html, /Anna VetoLayer/);
  assert.match(html, /href="\/bundle\/"/);
  assert.match(html, /href="\/review"/);
  assert.match(html, /href="\/privacy"/);
  assert.match(html, /rel="stylesheet" href="\/landing\.css"/);
  assert.match(styles, /@media \(max-width: 850px\)/);
  assert.match(styles, /prefers-reduced-motion/);
});

test("reviewer portal uses session tokens and renders untrusted receipts without HTML injection", async () => {
  const source = await readFile(resolve(__dirname, "../review-portal.js"), "utf8");
  assert.match(source, /session\?\.getToken\(\)/);
  assert.match(source, /textContent = actionTitle/);
  assert.doesNotMatch(source, /innerHTML/);
});

test("every reviewer portal DOM reference resolves to a unique element", async () => {
  const html = await readFile(resolve(__dirname, "../review.html"), "utf8");
  const source = await readFile(resolve(__dirname, "../review-portal.js"), "utf8");
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length);
  for (const match of source.matchAll(/\$\("([^"]+)"\)/g)) assert.ok(ids.includes(match[1]), `Missing portal element #${match[1]}`);
});

test("shared queue accepts review decisions only", async () => {
  const source = await readFile(resolve(__dirname, "../api/reviews/index.mjs"), "utf8");
  assert.match(source, /body\.receipt\.outcome !== "REVIEW"/);
});
