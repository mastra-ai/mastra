---
'@mastra/deployer': minor
'mastra': patch
---

Auto-construct a Mastra instance when no `index.ts` exists. If your `src/mastra`
directory has file-based primitives but no entry file, `mastra dev` and
`mastra build` now build and run the project without any boilerplate — no
`new Mastra({...})` required.

```
src/mastra/
  storage.ts          // export default new LibSQLStore({ url: 'file:./mastra.db' })
  observability.ts    // export default new Observability({ ... })
  server.ts           // export default { port: 4111 }
  studio.ts           // export default { ... }
  agents/weather/     // file-based agent
  workflows/report.ts // export default createWorkflow({ ... })
```

```sh
# No src/mastra/index.ts needed:
mastra dev
```

Projects that already export a `mastra` instance from `index.ts` are unaffected.
