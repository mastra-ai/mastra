---
'@mastra/deployer': patch
'mastra': patch
---

Fix `ENOENT: .mastra-fs-agents-entry.mjs` when running `mastra dev`/`mastra build` in a project that uses file-based agents. The generated fs-agents wrapper entry was written before `bundler.prepare()` emptied the output directory, so it was wiped before the bundler could read it. Wrapper generation is now split: `prepareFsAgentsEntry` returns the generated source without writing, and the new `writeFsAgentsEntry` writes it after `prepare()` runs.

```ts
const fsAgents = await prepareFsAgentsEntry({ entryFile, mastraDir, outputDirectory });
await bundler.prepare(outputDirectory); // empties output dir
await writeFsAgentsEntry(fsAgents); // wrapper now survives for the bundler
```
