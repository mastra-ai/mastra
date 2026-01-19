---
"@mastra/convex": patch
---

Fixed ConvexStore to properly expose the inherited getStore() method from MastraStorage. Changed the stores property declaration from an initialized property to a declared property, allowing proper inheritance resolution. Added createTable() and alterTable() as no-op methods for schema compatibility since Convex uses a declarative schema.
