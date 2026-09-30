---
"@mastra/core": patch
---

Fix durable agent runs hanging when a tool that requires approval is injected by an input processor (for example `ToolSearchProcessor`). The tool-call foreach concurrency gate only inspected the run-start tool metadata, so processor-added approval/suspend tools were invisible to it and could run in parallel. Parallel approval suspensions can leave a run permanently stuck, with subsequent approvals never resolving.

Fixed approval ordering for tools added by input processors. Each call waits for its own approval, including when a durable run resumes.
