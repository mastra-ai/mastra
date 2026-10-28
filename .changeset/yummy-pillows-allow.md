---
'@mastra/pg': patch
---

Fixed concurrent first boot of Postgres storage so API and worker processes can initialize the same empty schema without crashing on competing index or primary key creation.
