# Mastra Memory

Memory management for Mastra agents. Visit [the docs](https://mastra.ai/docs/memory/overview) for more information.

## Token counting for file parts

Observational Memory uses a built-in Token Counter to decide when to observe and reflect. You can attach an explicit estimate to an `image` or `file` part using `providerMetadata.mastra.tokenEstimate`:

```typescript
const filePart = {
  type: 'file',
  data: 'storage://bucket/large-report.pdf',
  mimeType: 'application/pdf',
  filename: 'large-report.pdf',
  providerMetadata: {
    mastra: {
      tokenEstimate: {
        v: 0,
        source: 'client',
        key: 'client',
        tokens: 100_000,
      },
    },
  },
};
```

The Token Counter honors caller-supplied estimates verbatim on `image` and `file` parts. See [Caller-supplied token estimates for file parts](https://mastra.ai/docs/memory/observational-memory#caller-supplied-token-estimates-for-file-parts) for details.
