---
'@mastra/memory': minor
---

Add `observeAttachments` to `ObservationConfig` for Observational Memory. Use it to control whether image/file parts on observed messages are forwarded to the Observer model alongside their placeholder text lines.

- `true` (default) — forward all attachments (existing behavior).
- `false` — drop all attachments; placeholders still appear in the observer transcript.
- `string[]` — allowlist of mimeType patterns, e.g. `['image/*']` or `['application/pdf']`. Matching is case-insensitive and supports exact, `type/*`, and `*` patterns.

Useful when the Observer model is text-only (some DeepSeek endpoints, etc.) while the main agent uses a multimodal model. Tool-result attachments are filtered with the same rule.

```ts
new Memory({
  options: {
    observationalMemory: {
      observation: {
        model: 'deepseek/deepseek-chat', // text-only observer
        observeAttachments: false, // or e.g. ['image/*', 'application/pdf']
      },
    },
  },
});
```
