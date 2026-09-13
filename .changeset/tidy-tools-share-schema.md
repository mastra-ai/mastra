---
'@mastra/core': patch
---

Stop `_background` from leaking between agents that share one tool instance. `CoreToolBuilder` no longer writes the spliced input schema back onto the shared tool object — the injected schema now lives on the builder, so each agent's model-facing parameters only advertise the injected keys when that agent actually opted in.
