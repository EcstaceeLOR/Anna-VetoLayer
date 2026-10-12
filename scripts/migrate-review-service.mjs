import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));

export function splitSqlStatements(source) {
  return source
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

export async function migrateReviewService({ databaseUrl = process.env.DATABASE_URL } = {}) {
  if (!databaseUrl) throw new Error("DATABASE_URL is not configured.");

  const schemaPath = resolve(scriptDirectory, "../review-service/schema.sql");
  const source = await readFile(schemaPath, "utf8");
  const statements = splitSqlStatements(source);
  const sql = neon(databaseUrl);

  for (const statement of statements) await sql.query(statement);
  return statements.length;
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) {
  try {
    const count = await migrateReviewService();
    console.log(`Applied ${count} review-service schema statements.`);
  } catch (error) {
    console.error(`Review-service migration failed: ${error.message}`);
    process.exitCode = 1;
  }
}
