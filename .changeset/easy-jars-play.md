---
'@mastra/core': patch
---

Fixed suspended agent runs writing snapshots that grew quadratically with step count, which could exhaust memory on human-in-the-loop workflows using tool approval with large payloads.

Each buffered step of a run persisted its own full copy of the conversation so far — three times over, as model messages, database messages, and UI messages. A fifteen-step run was observed writing 22 MB of buffered steps over 2 MB of distinct messages, and production runs reached 170 MB per suspended run.

Snapshots now record the IDs of the response messages referenced by each step and lazily rebuild those messages from the conversation that is already stored alongside them. This preserves the correct messages even when processors move or remove messages before suspension. Steps still expose the same messages after a run resumes, so no application code needs to change, while persisted snapshot size now grows linearly with step count.

Fixes [#17738](https://github.com/mastra-ai/mastra/issues/17738).
