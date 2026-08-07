---
'@mastra/deployer': minor
---

Added discovery and bundling for `instructions.ts` in file-based agent directories, so an agent can define its prompt in TypeScript instead of `instructions.md`.

```typescript title="src/mastra/agents/weather/instructions.ts"
export default 'You are a helpful weather assistant.';
```

Unlike `instructions.md`, whose text is inlined into the generated code, `instructions.ts` is imported. It can therefore import from the rest of your project, and `mastra dev` picks up edits through the normal module graph.

A directory holding only an `instructions.ts` now counts as an agent, and subagent directories follow the same rule. Symlinked `instructions.ts` files are skipped, matching how `config.ts` and `memory.ts` are handled.

If you already keep an unrelated `instructions.ts` inside an agent directory, for example a helper that `config.ts` imports, rename it. Mastra now reads that file as the agent's instructions and the build fails if it has no default export.
