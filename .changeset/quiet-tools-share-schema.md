---
'@mastra/core': patch
---

Stop `_background` from leaking between agents that share one tool instance. `CoreToolBuilder` no longer writes the spliced input schema (with `_background` / `suspendedToolRunId` / `resumeData`) back onto the shared tool object — the schema now lives on the builder, so each agent's model-facing parameters only advertise the injected keys when that agent actually opted in. This also stops repeated conversions from re-wrapping Zod v3 / JSON schemas with nested override validators.
