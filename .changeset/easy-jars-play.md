---
'@mastra/core': patch
---

Fixed suspended agent runs writing snapshots that grew quadratically with step count, which could exhaust memory on human-in-the-loop workflows using tool approval with large payloads.

Each buffered step of a run persisted its own full copy of the conversation so far — three times over, as model messages, database messages, and UI messages — plus a copy of the prompt and tool catalog. A fifteen-step run was observed writing 22 MB of buffered steps over 2 MB of distinct messages, and production runs reached 170 MB per suspended run.

Snapshots now record how many response messages existed at each step and rebuild those messages from the conversation that is already stored alongside them. Steps still expose the same messages after a run resumes, so no application code needs to change. In a benchmark run, the persisted snapshot shrank by roughly 14x and now grows linearly with step count.

Fixes [#17738](https://github.com/mastra-ai/mastra/issues/17738).
