---
'@mastra/azure-ai-search': patch
---

Fixed a critical bug where an unsupported metadata filter operator on a field (for example `$regex`, `$size`, `$all`, or a typo like `$gtee`) was silently dropped instead of raising an error. Previously, a query with such a filter would run unfiltered across the entire index instead of failing, returning results the filter should have excluded. Unsupported operators now throw immediately, matching the existing behavior for unsupported top-level operators.

**Why:** Silently dropping part of a filter can leak records that should have been excluded by access-control or scoping filters, so it needs to fail loudly instead.
