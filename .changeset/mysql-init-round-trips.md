---
'@mastra/mysql': patch
---

Cut warm initialization from hundreds of client-server round trips to single digits with an init-scoped schema snapshot. Three information_schema reads at the start of init() now answer table, column, and index existence locally; createTable, alterTable, createIndex, and hasColumn consult the snapshot and maintain it as objects are created, and the memory domain's raw CREATE INDEX for idx_om_lookup_key consults it too instead of raising and swallowing ER_DUP_KEYNAME on every boot. The snapshot lives for exactly the init window and is cleared in a finally, so runtime callers keep querying the live catalog. Measured on docker mysql:9.7: warm init 111 round trips to 7 (6 excluding measurement scaffolding), cold init 253 to 153, with an identical cold-init table and index census before and after.
