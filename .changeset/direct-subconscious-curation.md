---
'@mastra/memory': patch
'@mastra/code-sdk': patch
'@mastra/factory': patch
---

Simplify experimental Subconscious knowledge ingestion to two observation-time agents. `remind` continues to retrieve relevant knowledge, while `curate` now receives each committed observation directly and owns both initial durable ingestion and reconciliation through constrained knowledge tools.

The experimental `capture` and `learn` agents, reflection-time Subconscious execution, curation cadence, manual worklist curation, and Factory capture-pinning/phase-exit curation configuration have been removed. Curator failures are best-effort: they are reported without failing the committed observation, but are not automatically replayed.
