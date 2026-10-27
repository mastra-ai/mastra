---
'@mastra/playground-ui': minor
---

Improved span details in the trace viewer so they are easier to read:

- Model spans show a short summary: provider and model, finish reason, time to first token, output speed, and token counts.
- Tools available to a span get their own **Tools** section. Workflow tools (`workflow-<key>`) and sub-agent tools (`agent-<key>`) link to their workflow or agent page.
- Skills catalogs in system prompts appear as a list of skills instead of raw XML.
- Stored messages show up as chat bubbles in every span. Reasoning and tool calls no longer appear as raw JSON.
- Processor and chunk spans with an empty `{}` output no longer show an Output section.
- The span header shows the run id, and span and trace durations use the same format.
