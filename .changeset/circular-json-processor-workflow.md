---
'@mastra/memory': patch
---

Fixed a "Converting circular structure to JSON" crash that happened when Observational Memory was enabled and an input or output processor was composed as a workflow (the documented "run guardrails in parallel" pattern).

Observational Memory tracks each turn with internal runtime objects that reference one another in a cycle. That cycle reached the nested processor workflow's persisted snapshot, where it broke storage two ways: PostgreSQL (and any adapter that uses a plain `JSON.stringify`) threw outright, while LibSQL silently persisted a corrupted snapshot with the cycle rewritten to `"[Circular]"`. Observational Memory now serializes those runtime objects to a compact, acyclic form, so workflow-composed guardrails and Observational Memory work together and snapshots persist intact.
