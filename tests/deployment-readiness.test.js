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
  const names = ["DATABASE_URL", "CLERK_SECRET_KEY", "REVIEW_ALLOWED_ORIGINS", "REVIEW_AUTHORIZED_PARTIES"];
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
