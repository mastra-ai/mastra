# mastracode/src/v1

Greenfield rebuild of the MastraCode TUI on top of **Harness v1**
(`@mastra/core/harness/v1`).

The legacy TUI in `mastracode/src/tui/` is built against the legacy
`Harness` from `@mastra/core/harness`. This folder is a parallel
implementation that targets the v1 surface — `harness.session(...)`,
`session.message`, `session.queue`, `session.signal`,
`session.permissions.*`, `session.skills.*`, `session.om.*`, etc.

## Layout

- `main.ts` — entry point. Run via `pnpm cli:v1` from `mastracode/`.
- `bootstrap.ts` — builds a v1 `Harness` and the dependencies the TUI needs.
- `tui/` — TUI surface (state, rendering, input loop, commands).

## Running

```
pnpm --filter mastracode cli:v1
```

## Notes for agents

- Do **not** import from `mastracode/src/tui/` (legacy) here. The two
  trees are intentionally independent during the rebuild.
- Do **not** import from `@mastra/core/harness` here. Use
  `@mastra/core/harness/v1` exclusively.
- Reorganisation happens after parity. For now keep everything inside
  `mastracode/src/v1/`.
