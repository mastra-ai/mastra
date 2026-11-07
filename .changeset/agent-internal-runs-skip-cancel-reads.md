---
'@mastra/core': patch
---

Agents make fewer storage reads per message.

Framework-created workflows for stream preparation and input/output processors skip cancellation-status reads for fresh runs. These workflows never save snapshots and are canceled within their owning process.

User workflows, including workflows supplied as processors, keep their existing cancellation checks regardless of snapshot settings or per-run overrides.
