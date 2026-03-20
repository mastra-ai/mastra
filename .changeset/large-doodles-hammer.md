---
'mastra': patch
---

Improved skill detail page breadcrumb navigation by validating the agentId query parameter against the cached agent list. Invalid or tampered agentId values now gracefully fall back to the workspace breadcrumb instead of showing broken navigation.
