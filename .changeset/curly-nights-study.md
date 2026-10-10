---
'@mastra/mongodb': patch
---

Fixed observational memory losing buffered observations or activated context when reflections, observation activation, and background buffering overlap, including from several processes. Works on standalone servers and replica sets without transactions. Fixed buffered observations whose text starts with `$` being stored incorrectly.

**Upgrading.** A `supersededBy` field is set on observational memory documents automatically: existing documents are backfilled at the next startup of any process. Protection is complete once every process that shares the database runs the new version. Safe concurrent use relies on the unique `id` index on the observational memory collection, which is created by default; if you use `skipDefaultIndexes`, create it yourself (a warning is logged when it is missing).
