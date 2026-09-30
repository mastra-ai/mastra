---
"@mastra/core": patch
---

Fix durable agent runs hanging when a tool that requires approval is injected by an input processor (for example `ToolSearchProcessor`). The tool-call foreach concurrency gate only inspected the run-start tool metadata, so processor-added approval/suspend tools were invisible to it and could run in parallel. Parallel approval suspensions can leave a run permanently stuck, with subsequent approvals never resolving.

Tool calls now carry `requireApproval`/`hasSuspendSchema` stamps taken from the step's effective tool set, and the concurrency resolver treats a stamped call as requiring sequential execution. The stamps are persisted with the calls, so the behavior also holds after a cold durable resume.
