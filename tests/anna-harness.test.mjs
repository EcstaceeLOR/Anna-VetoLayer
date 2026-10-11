import { describe, expect, it } from "vitest";
import { HostApiError, mountBundle } from "@anna-ai/cli/test";
import manifest from "../manifest.json" with { type: "json" };

const action = {
  actor: "Release Agent",
  tool: "github",
  operation: "deploy",
  target: "payments-api",
  environment: "production",
  impact: "code",
  summary: "Deploy the approved release after staging verification.",
  evidence: ["CI run 4821"],
  rollback_plan: "Deploy the prior release."
};

describe("Anna runtime harness", () => {
  it("records the policy, contextual, APS, and transient-artifact flow", async () => {
    const harness = await mountBundle({
      manifest,
      mocks: {
        "tools.invoke": ({ args }) => ({ result: { data: { receipt_id: "rcpt_harness", outcome: "REVIEW", hard_block: false, requires_context: true, action: args.args } } }),
        "llm.complete": () => ({ content: { text: '{"outcome":"REVIEW"}' }, model: "anna-test" }),
        "chat.append_artifact": () => ({ artifact_id: "artifact_harness" })
      }
    });
    const policy = await harness.runtime.tools.invoke({ tool_id: "tool-policy", method: "evaluate_action", args: action });
    await harness.runtime.llm.complete({ messages: [{ role: "user", content: "Review this action" }] });
    await harness.runtime.storage.set({ key: "receipts/rcpt_harness", value: policy.result.data });

    expect(policy.result.data.receipt_id).toBe("rcpt_harness");
    expect(harness.calls.byNs("tools.invoke")).toHaveLength(1);
    expect(harness.calls.byNs("llm.complete")).toHaveLength(1);
    expect(harness.calls.byNs("storage.set")).toHaveLength(1);
    expect(harness.runtime.storage.list).toBeUndefined();
    // CLI 0.1.58 exposes the old chat proxy only, but its ACL derives the current grant.
    expect(harness.acl.allowed.has("chat.append_artifact")).toBe(true);
  });

  it("enforces the manifest ACL for unavailable capabilities", async () => {
    const harness = await mountBundle({ manifest });
    await expect(harness.runtime.fs.read({ path: "/private/action-evidence" })).rejects.toBeInstanceOf(HostApiError);
    expect(harness.calls.last().outcome).toBe("denied");
  });

  it("accepts entry payload events without executing a tool call", async () => {
    const harness = await mountBundle({ manifest });
    harness.events.emit("entry_payload", { schema_version: "anna-vetolayer.entry-payload.v1", request_id: "request-harness" });
    await harness.wait(0);
    expect(harness.calls.byNs("tools.invoke")).toHaveLength(0);
  });
});
