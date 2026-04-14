---
'@mastra/core': minor
---

Added version overrides for sub-agent delegation. You can now specify which versions of sub-agents to use at three levels: Mastra instance config, per-invocation `generate()`/`stream()` options, and server request body.

**Mastra instance config (global defaults)**

```ts
const mastra = new Mastra({
  agents: { supervisor, researcher },
  versions: {
    agents: {
      researcher: { versionId: 'abc123' },
    },
  },
});
```

**Per-invocation overrides**

```ts
const result = await supervisor.generate('Research this topic', {
  versions: {
    agents: {
      researcher: { status: 'published' },
    },
  },
});
```

Version resolution cascades: call-site > requestContext > Mastra instance defaults > code-defined agent. Versions propagate automatically through sub-agent delegation via requestContext.
