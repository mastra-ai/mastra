---
'@mastra/playground-ui': patch
---

Give every text-only Button an icon via `icon={...}`: entity icons from the sidebar (Agent, Workflow, Dataset, Scorer, Trace, Memory, Tools, …) when the action targets a Mastra entity, lucide icons by action verb otherwise (Cancel → `X`, Save → `Check`, Delete → `Trash2`, Connect → `Plug`, Publish → `Rocket`, …). Buttons whose label is data (ids, values, zoom level) and pass-through wrappers are left unchanged.
