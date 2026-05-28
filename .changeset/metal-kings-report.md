---
'@mastra/core': minor
'@mastra/client-js': minor
'@mastra/editor': minor
'@mastra/server': minor
---

Added code-mode agent override support.

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

Studio applies stored overrides only for fields owned by the editor config. Filesystem editor storage can also persist code-mode overrides as deterministic per-agent JSON files.

The server and client now expose an agent override export API so Studio can download code-mode overrides as JSON for review or commit workflows.

`MastraEditor` accepts a `mode` setting that picks the editing experience:

```ts
new MastraEditor({ mode: 'code' });
```

- `mode: 'code'` — Studio swaps Save/Publish for Download JSON and Open PR, and the editor auto-wires a `FilesystemStore` (defaulting to `./mastra/editor/`, overridable with `codePath`) when no editor storage is supplied.
- `mode: 'db'` (default) — Studio keeps the existing Save/Publish flow against whatever storage the project has configured.

Per-agent `editor: false` still locks an agent in either mode.
