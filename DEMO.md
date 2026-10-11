# Anna VetoLayer demo script

Target length: 90–120 seconds.

## 1. Frame the problem — 15 seconds

“Giving an AI agent access to a tool tells us what it can do, not whether this exact action should execute now. Anna VetoLayer is the pre-flight approval layer for consequential agent actions.”

Show the Evaluate screen and point to the four-step control path in the sidebar.

## 2. Prove hard policy — 20 seconds

Select **Secret export** and click **Run checkpoint**.

Call out:

- the deterministic policy engine returns `BLOCK`;
- the risk score reaches 100;
- Anna contextual reasoning is skipped because it cannot overrule a hard boundary;
- a Decision Receipt is created.

## 3. Prove meaningful Anna AI — 30 seconds

Select **Production deploy** and run the checkpoint.

Call out:

- deterministic policy recognizes production scope and the missing rollback plan;
- Anna analyzes intent and evidence only because context matters;
- the outcome remains `REVIEW` because critical evidence is missing;
- the result lists exactly what a reviewer needs next.

## 4. Prove human review and lineage — 25 seconds

Open **Review queue**. Add a concrete note such as:

> Rollback command tested in staging run 1842; release manager approval attached.

Choose **Approve with evidence**. Explain that VetoLayer creates a child receipt rather than rewriting the original REVIEW decision.

## 5. Prove auditability and Anna fit — 20 seconds

Open **Receipts** and show the REVIEW plus its resolved child receipt. Return to the latest result and use **Send to chat** or **Export JSON**.

Close with:

“Anna supplies the app runtime, tool invocation, contextual AI, persistent storage, and chat handoff. VetoLayer supplies the safety contract: deterministic rules first, AI for ambiguity, human judgment with evidence, and a receipt for every decision.”
