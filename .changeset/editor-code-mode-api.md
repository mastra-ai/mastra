---
'@mastra/core': minor
'@mastra/editor': minor
---

Added agent override support to the agent and editor APIs.

Code-defined agents can now declare which fields Studio may edit with the `editor` option:

```ts
new Agent({
  name: 'Weather Agent',
  model,
  editor: {
    instructions: true,
    tools: { description: true },
  },
});
```

The editor applies stored overrides only for fields the `editor` config owns, so locked fields keep their code-defined values. Per-agent `editor: false` locks an agent entirely.

`MastraEditor` accepts a `source` setting that picks the editing experience:

```ts
new MastraEditor({ source: 'code' });
```

- `source: 'code'` — the editor auto-wires a `FilesystemStore` (defaulting to `./mastra/editor/`, overridable with `codePath`) when no editor storage is supplied, and persists overrides as deterministic per-agent JSON files.
- `source: 'db'` (default) — keeps the existing storage-backed flow against whatever storage the project has configured.
