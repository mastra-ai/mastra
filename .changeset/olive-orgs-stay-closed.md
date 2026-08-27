---
'@mastra/factory': patch
---

Factory-hosted sessions now start with `factoryOrgUnresolved: true`, so a session whose organization seeding fails refuses knowledge capture instead of writing to the local knowledge graph. Successful org seeding still clears the marker and a resolved organization still takes precedence.
