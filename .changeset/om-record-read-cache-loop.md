---
"@mastra/memory": patch
---

Observational memory loop-step execution is faster because the processor now avoids redundant record reads that contributed 2-4s latency per step in the reported workflow. Cached observational-memory records are reused within a loop step while preserving buffering progress updates and pending-token persistence.
