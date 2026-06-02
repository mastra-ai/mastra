---
'@mastra/core': minor
---

Workflows that suspend during dataset experiments now resume automatically. Provide resume data in your dataset items and the workflow will continue execution through multiple suspend/resume cycles.

For multi-step workflows, use `resumeSteps` keyed by step ID:

```typescript
const item = {
  input: { prompt: 'Draft a blog post' },
  resumeSteps: { 'approval-step': { approved: true } },
};
```

For single-step workflows, use flat `resumeData`:

```typescript
const item = {
  input: { prompt: 'Draft a blog post' },
  resumeData: { approved: true },
};
```

Storage-backed items can use `metadata.resumeSteps` or `metadata.resumeData` as fallback. When no resume data is provided, the suspend payload is returned as output with guidance on how to add it. ([#15382](https://github.com/mastra-ai/mastra/issues/15382))
