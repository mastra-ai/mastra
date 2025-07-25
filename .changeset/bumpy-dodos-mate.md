---
'@mastra/core': patch
---

Fix conditional branch execution after nested workflow resume. Now conditional branches properly re-evaluate their conditions during resume, ensuring only the correct branches execute.
