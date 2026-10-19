---
'@mastra/core': patch
---

Scorer run and scorer step spans now record the scorer name as `entityName`, falling back to the scorer ID. Previously scorer traces had no entity name, so filtering or grouping traces by entity name left them out.
