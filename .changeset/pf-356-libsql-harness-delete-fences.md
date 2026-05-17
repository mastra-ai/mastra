---
"@mastra/libsql": patch
---

Added LibSQL support for Harness thread-scoped session lookups and durable thread delete fences.

The adapter now records a per-acquisition fence lease, renews only the current lease, clears local fence state during destructive test resets, and exposes thread-scoped active session scans so Harness thread deletion can fail closed without resource-wide scans.
