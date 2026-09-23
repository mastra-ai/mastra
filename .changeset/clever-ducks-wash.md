---
'@mastra/clickhouse': patch
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/pg': patch
---

Fixed a race where two workers holding the same terminal admission could both dispatch the provider: the native chat terminal message path now stamps its dispatch marker through an atomic compare-and-swap, and the loser joins the durable winner instead of sending a second turn. Session fencing is now durable per incarnation so admissions inserted after a fence can no longer commit, and committed message evidence survives session deletion for committed retries.
