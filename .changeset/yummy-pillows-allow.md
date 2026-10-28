---
'@mastra/pg': patch
---

Fixed concurrent first boot of Postgres storage so API and worker processes can initialize the same empty schema without crashing on competing index or primary key creation. Initialization leaves active index builds to their owners and only marks confirmed-valid indexes as ready. Abandoned invalid indexes are repaired under a short transaction-scoped table lock, with bounded retries when the table is busy, without dropping a competing process's replacement.
