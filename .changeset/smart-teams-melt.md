---
'@mastra/langsmith': minor
---

Added `withLangsmithMetadata` helper for dynamic LangSmith configuration per-span.

**Why:** Previously, `projectName` could only be set globally in the exporter config. Users needed to dynamically route traces to different LangSmith projects based on runtime conditions (e.g., customer tier, environment).

**Before:**
```typescript
const tracingOptions = buildTracingOptions();
// No way to override projectName per-span
```

**After:**
```typescript
import { buildTracingOptions } from '@mastra/observability';
import { withLangsmithMetadata } from '@mastra/langsmith';

const tracingOptions = buildTracingOptions(
  withLangsmithMetadata({
    projectName: 'enterprise-traces',
    sessionId: 'user-123',
  }),
);
```

Follows the same pattern as `withLangfusePrompt` in the Langfuse exporter.
