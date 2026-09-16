---
'@mastra/core': patch
---

Fixed workflow and agent delegation tools adopting a malformed model-supplied `suspendedToolRunId`. Some models emit the literal string `"null"` for this optional auto-resume field on fresh calls; because that string is truthy, two independent workflow-tool calls could collide on a single run (silently dropping one), and agent delegation could try to resume a non-existent run and crash. Sentinel strings (`"null"`, `"undefined"`, `"none"`, `"nil"`) are now treated as absent at every point where the field crosses the model boundary.

**Behavior change**: workflow tools now only honor a supplied `suspendedToolRunId` together with `resumeData` — fresh calls always receive a framework-generated unique run id. If you pinned `args.suspendedToolRunId` in a `beforeToolCall` hook (the documented workaround for run-id collisions), that pin is no longer applied on fresh calls — and is no longer needed. Fixes [#23739](https://github.com/mastra-ai/mastra/issues/23739).
