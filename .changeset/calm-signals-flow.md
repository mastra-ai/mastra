---
'@mastra/playground-ui': minor
---

Render server-defined trace signals in catalog order with custom labels, colors, lifecycle progress, and built-in fallbacks.

```tsx
<TraceIntelligenceProvider signalCatalog={entity.signalCatalog}>
  <TraceIntelligenceEntityDetail entityType={entity.entityType} entityId={entity.entityId} />
</TraceIntelligenceProvider>
```
