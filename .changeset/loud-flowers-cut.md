---
'@mastra/convex': patch
---

Improved type safety of the Convex storage layer. Table names accepted by the internal ConvexDB are now a closed union (core storage tables plus the observational memory table) instead of any string, so table-name typos are caught at compile time instead of silently routing records to the mastra_documents fallback table. The internal observational memory operations no longer take a table-name argument.
