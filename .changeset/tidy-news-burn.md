---
'@mastra/core': minor
---

Added native PNG, JPEG, WebP, and PDF media output to skill_read for assets up to 10 MiB. As with read_file, the media type comes from the file's contents rather than its extension, so an asset saved under the wrong extension is sent as what it contains, or as text. Text reads and metadata-only binary fallbacks are preserved. Fixes https://github.com/mastra-ai/mastra/issues/25219.

With a skill that includes `assets/logo.png`, the same request now gives the model the image instead of a binary-file placeholder:

```typescript
await agent.generate('Use the design-system skill and read assets/logo.png.');
```
