# @mastra/factory

The Mastra Software Factory module: the server core behind the Mastra Software Factory — an agent-powered software delivery environment built on [Mastra](https://mastra.ai).

Like `@mastra/code-sdk`, this package ships an unbundled ESM build that preserves the `src/` module structure, so every module is importable via the `@mastra/factory/*` wildcard export.

## Development (monorepo)

This package lives in the `mastra-ai/mastra` monorepo at `mastracode/factory`.

```bash
pnpm --filter ./mastracode/factory build   # transpile src -> dist + types
pnpm --filter ./mastracode/factory test    # vitest
pnpm --filter ./mastracode/factory check   # tsc --noEmit
```

## License

Apache-2.0
