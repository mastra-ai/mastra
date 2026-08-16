---
'@mastra/mysql': patch
---

Fix the alterTable existing-column probe reading the wrong information_schema field casing. MySQL returns result fields with uppercase keys through mysql2, so the probe's existing-column set was always empty and every warm boot re-ran 107 ALTER TABLE ADD COLUMN statements that failed with ER_DUP_FIELDNAME and were silently swallowed, taking metadata locks on production tables for nothing. The probe now reads whichever key casing is present. Measured on docker mysql:9.7: warm init drops from 324 to 109 client-server round trips and issues zero ALTER statements.
