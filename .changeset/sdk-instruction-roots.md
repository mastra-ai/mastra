---
'@mastra/code-sdk': minor
---

Added the `instructionRoots` session state field. A host that checks out several repositories under one working directory lists their directories, and the system prompt loads each one's `AGENTS.md` or `CLAUDE.md` in that order. Without it, instructions load from the working directory as before.

```ts
await controller.setState({
  projectPath: '/workspace',
  instructionRoots: ['api', 'web'], // loads /workspace/api/AGENTS.md, then /workspace/web/AGENTS.md
});
```

On an untrusted checkout with a `baseRef`, only the first root loads, from that ref.
