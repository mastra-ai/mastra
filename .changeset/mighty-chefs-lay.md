---
'@mastra/convex': minor
---

Add observability domain support for Mastra Studio trace persistence (#12079)
Convex storage now supports the observability domain, enabling trace/span persistence for Mastra Studio's observability features.
New exports:
mastraSpansTable - Convex table definition for the mastra_ai_spans table
ObservabilityConvex - Domain class for direct usage with pre-configured clients
Supported operations:
createSpan, getSpan, getRootSpan, getTrace
updateSpan, listTraces (with full filter support)
batchCreateSpans, batchUpdateSpans, batchDeleteTraces
Migration required for existing users:
Update your convex/schema.ts to include the new spans table:

import { 
    // ... existing imports ... 
    mastraSpansTable,
    } from '@mastra/convex/schema';

export default defineSchema({ 
    // ... existing tables ... 
    mastra_ai_spans: mastraSpansTable,
});

Then deploy: npx convex deploy
