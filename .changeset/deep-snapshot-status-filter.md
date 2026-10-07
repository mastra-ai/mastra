---
'@mastra/cloudflare-d1': patch
'@mastra/cloudflare': patch
---

Fixed `listWorkflowRuns({ status })` failing the whole query with `malformed JSON` when any stored snapshot was nested deeper than SQLite's JSON depth limit. Such snapshots are now skipped by the status filter, and other runs are returned normally.
