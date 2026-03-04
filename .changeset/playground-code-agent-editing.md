---
'@mastra/playground-ui': minor
'@mastra/server': patch
---

Added support for editing code-defined agents in the Playground CMS. When a code agent is opened in the editor, only **Instructions**, **Tools**, and **Variables** sections are shown — model, memory, workspace, and other code-defined fields are hidden since they cannot be safely serialized.

On first save, a stored override record is created with the same agent ID. Subsequent saves update the override. The server now applies stored overrides (instructions, tools) to code-defined agents before serializing them in `GET /agents` and `GET /agents/:id` responses.
