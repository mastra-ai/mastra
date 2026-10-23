---
'@mastra/factory': minor
'@mastra/playground-ui': minor
---

Add integrated browser support to the Factory agent.

- `MastraFactoryConfig` now accepts an optional `browser` provider (typically an
  `AgentBrowser` with `scope: 'thread'`). When supplied, it is threaded through
  `prepareAgentControllerMount` so the Factory controller gains the full
  `browser_*` toolset — exactly the same wiring the Mastra SDK uses for its own
  TUI browser. Omit `browser` to keep the controller browser-free; nothing on
  the UI side renders when the server does not expose a session.
- Lifted the browser-view surface (components, context, hooks, utilities) from
  `@internal/playground` into `@mastra/playground-ui` so Factory-UI (and any
  other playground-ui consumer) can mount the same screencast + thumbnail +
  modal panel that Studio uses, without pulling in Studio-specific routing.
  New public entry points:
  - `@mastra/playground-ui/domains/agents/components/browser-view/*`
    (`BrowserThumbnail`, `BrowserViewPanel`, `BrowserViewFrame`,
    `BrowserViewHeader`, `BrowserToolCallHistory`, `BrowserToolCallItem`,
    `AgentBusyOverlay`, `ClickRippleOverlay`)
  - `@mastra/playground-ui/domains/agents/context/browser-session-provider`
    (`BrowserSessionProvider`) and `.../browser-session-context`
    (`useBrowserSession`, `useBrowserFrame`)
  - `@mastra/playground-ui/domains/agents/hooks/*`
    (`useBrowserStream`, `useClickRipple`, `useInputCoordination`,
    `useKeyboardInteraction`, `useMouseInteraction`)
  - `@mastra/playground-ui/hooks/use-restore-focus`

Studio consumers continue to work unchanged — `@internal/playground` now
re-exports these modules from `@mastra/playground-ui` through the existing
`domains/agents` and `domains/agents/context` barrels.
