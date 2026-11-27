---
'@mastra/client-js': minor
'@mastra/react': minor
---

Factory's client and React hooks now cover card sessions, audit events, board definitions and intake routes.

- `factory.sessionActivity()`, `factory.auditEvents()`, `factory.boardCatalog()`, `factory.board(key)`, `factory.replaceBoard(key, body)` and `factory.intakeRoutes()`
- Refused requests throw `FactoryRequestError`, which carries the server's refusal `code` (for example `revision_mismatch`) and its `reasons`
- Hooks: `useCardSessions`, `useRecentAuditEvents`, `useBoardCatalog`, `useBoardQuery`, `useSaveBoardMutation`, `useIntakeRoutesQuery`, `useCanEditBoards`
