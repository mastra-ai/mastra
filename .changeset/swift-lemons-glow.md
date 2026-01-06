---
'@mastra/langsmith': minor
---

Add projectName config option for LangSmith exporter

You can now specify which LangSmith project to send traces to via the `projectName` config option. This overrides the `LANGCHAIN_PROJECT` environment variable.

```typescript
new LangSmithExporter({
  apiKey: process.env.LANGSMITH_API_KEY,
  projectName: 'my-custom-project',
})
```

