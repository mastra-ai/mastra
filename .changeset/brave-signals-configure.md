---
'@mastra/client-js': minor
'@mastra/playground-ui': minor
---

Add host-injected trace signal management contracts and an OSS-owned Intelligence settings pane for custom signal configuration. Custom signal instructions use one task prompt field without a separate response-rules contract.

```tsx
<TraceIntelligenceProvider signalManagement={signalManagement}>
  <TraceIntelligenceEntityIndex {...indexProps} />
</TraceIntelligenceProvider>
```
