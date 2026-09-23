---
'@mastra/core': patch
---

Fixed AgentController tool approvals so they always go to the run, thread and resource that requested them. Before, an approval handled after the session had moved on to a newer run could resume the wrong run.
