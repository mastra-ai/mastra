---
'@mastra/playground-ui': minor
---

Studio chat renders the built-in `request_connection` tool result as a connect card: provider rows with Connect actions that drive the mounted `userConnectRoutes()` flow (session → launch gate popup → status polling) so users can connect an account without leaving the conversation. Historical messages render the card read-only. The end-user connections domain (`@mastra/playground-ui/domains/connect`) now also exports a `usePendingConnect` hook that owns the popup + polling lifecycle, including recovery when the popup is closed, the poll fails, or the poll budget runs out, and a `settled` outcome (`active` / `failed`) so UIs can react when a flow finishes.
