---
'mastra': minor
---

`mastra dev` and `mastra build` now pick up file-based agents defined under `src/mastra/agents/<name>/`. Agents created this way appear in Studio and respond just like agents registered in code, and the two styles can be mixed in one project. Files committed under `agents/<name>/workspace/` are mirrored into the agent's workspace so it starts with them on disk.
