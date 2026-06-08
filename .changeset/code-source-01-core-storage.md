---
'@mastra/core': minor
'@mastra/editor': minor
---

Added source-backed storage primitives for code-mode agent editing.

Mastra now exposes a `SourceControlProvider` interface for hosted source-control-backed editor storage, and `MastraEditor` can persist code-mode agent overrides through either local filesystem storage or a source provider.

```ts
const editor = new MastraEditor({
  source: 'code',
  sourceControlProvider,
});
```

Code-defined agents still respect their `editor` ownership config, while source-backed storage can read, write, list history, and open change requests through a provider implementation.
