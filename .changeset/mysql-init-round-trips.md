---
'@mastra/mysql': patch
---

Cut warm initialization from around 110 client-server round trips to single digits with an init-scoped schema snapshot, on top of the column-probe casing fix that removed the ALTER TABLE storm. Three information_schema reads at the start of init() now answer table, column, and index existence locally; createTable, alterTable, createIndex, and hasColumn consult the snapshot and maintain it as objects are created, and the memory domain's raw CREATE INDEX for idx_om_lookup_key consults it too instead of raising and swallowing ER_DUP_KEYNAME on every boot. The snapshot lives for exactly the init window and is cleared in a finally, so runtime callers keep querying the live catalog. Measured on docker mysql:9.7: warm init 109 to 111 round trips down to 7 (6 excluding measurement scaffolding), cold init 253 down to 153 or 154 across runs, with an identical cold-init table and index census before and after.
