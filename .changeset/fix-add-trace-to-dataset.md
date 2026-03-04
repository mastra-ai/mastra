---
'@mastra/playground-ui': patch
---

Fix dataset schema validation when saving traces and scores as dataset items.

- Align `AGENT_INPUT_SCHEMA` and `AGENT_OUTPUT_SCHEMA` with actual agent input/output shapes (support structured content parts, rich output objects)
- Update scorer schemas to accept structured message content
- Unwrap legacy `{ messages }` wrapper from agent_run spans in trace-as-item dialog
- Add "Save as Dataset Item" button to score dialog for scorer calibration workflows
