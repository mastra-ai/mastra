---
'@mastra/posthog': patch
---

Add tags support to PostHog exporter

Include `tracingOptions.tags` in PostHog event properties as `$ai_tags` for root spans, enabling filtering and segmentation in PostHog.

```typescript
const result = await agent.generate({
  messages: [{ role: "user", content: "Hello" }],
  tracingOptions: {
    tags: ["production", "experiment-v2"],
  },
});
// PostHog event now includes: { $ai_tags: ["production", "experiment-v2"] }
```

