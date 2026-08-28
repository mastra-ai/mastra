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

## Developer tooling: conversation simulation

`scripts/simulate/` replays real conversation threads through the Subconscious capture and
curation pipeline against a local Postgres, so a capture or curation prompt change can be
A/B'd on real data instead of deployed and waited on. See
[`scripts/simulate/README.md`](./scripts/simulate/README.md) for prerequisites, the database
topology, and the extract → replay → A/B flow.
