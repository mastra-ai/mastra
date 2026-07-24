---
'@mastra/pg': patch
---

Fixed a crash where losing the database connection while a client was checked out (idle between queries) — e.g. an idle-connection timeout from a pooler or NAT, a backend restart, or a terminated backend — would crash the host process. Affected stores now attach a client-level error handler for the lifetime of every checkout, so the dead connection is discarded and a recoverable error is surfaced instead of taking down the process.
