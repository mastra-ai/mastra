---
"@mastra/convex": patch
---

Fixed ConvexStore so storage.getStore(domain) works properly, preventing runtime errors in flows that access domain stores.
Added no-op schema methods (createTable, alterTable) to keep storage migrations compatible with Convex's declarative schema.
Relates to `#11361`.

