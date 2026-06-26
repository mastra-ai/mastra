---
'mastra': patch
---

Fixed several workflow graph issues in Studio:

- **Step centering** — Selecting a step in the run timeline now pans and zooms the graph to center that step's node again.
- **Step-by-step (debug) mode** — The graph now automatically centers the step a paused run is waiting on, so the step about to run is always in view. Clicking a different timeline step still takes priority and focuses that step instead.
- **Nested graphs** — "View nested graph" on a step opens the nested workflow view again. Selecting a nested step reveals the nested flow in a side panel, and "Hide nested graph" closes it.
- **Conditional branch coloring** — When a conditional selects one arm, edges into the un-taken arm now stay neutral instead of incorrectly turning green.
- **Duplicate React keys** — Fixed graph rendering to avoid duplicate keys when a step ID and a condition ID overlap.
- **Agent chat workflow badge** — Fixed agent chat crashing when an agent calls a workflow tool (the embedded workflow graph was missing its step-detail and selected-step providers).
