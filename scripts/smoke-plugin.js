"use strict";

const { spawn } = require("node:child_process");
const path = require("node:path");
const readline = require("node:readline");

const plugin = spawn(process.execPath, [path.join(__dirname, "..", "executas", "policy-engine", "policy-engine.js")], {
  stdio: ["pipe", "pipe", "inherit"]
});
const output = readline.createInterface({ input: plugin.stdout });
const replies = [];

output.on("line", (line) => {
  replies.push(JSON.parse(line));
  if (replies.length === 2) {
    const [describe, evaluation] = replies;
    if (!describe.result?.tools?.length || evaluation.result?.data?.outcome !== "BLOCK") {
      process.exitCode = 1;
    } else {
      process.stdout.write("Executa smoke test passed: describe + authoritative BLOCK.\n");
    }
    plugin.kill();
  }
});

plugin.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "describe" })}\n`);
plugin.stdin.write(
  `${JSON.stringify({
    jsonrpc: "2.0",
    id: 2,
    method: "invoke",
    params: {
      tool: "evaluate_action",
      arguments: {
        actor: "Security Agent",
        tool: "vault",
        operation: "export secret",
        target: "production credentials",
        environment: "production",
        summary: "Export secret tokens outside the approved security boundary.",
        impact: "data"
      }
    }
  })}\n`
);

setTimeout(() => {
  if (replies.length < 2) {
    process.stderr.write("Executa smoke test timed out.\n");
    process.exitCode = 1;
    plugin.kill();
  }
}, 5000).unref();
