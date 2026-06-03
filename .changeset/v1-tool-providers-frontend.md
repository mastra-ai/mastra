---
'@internal/playground': patch
---

Add Studio UI for v1 ToolProvider integrations:

- New `/integrations` page lists configured providers and per-toolkit connections, with an OAuth authorize/disconnect flow and admin-grouped author rows.
- On a selected integration tool, the connections shown as badges are the ones the agent uses — they're kept in sync automatically (no separate "pick a connection" step). A Connect on a tool card still auto-checks the tool and uses the freshly authorized connection.
- Builder picker is scoped to the caller's `authorId` by default — admins see the same self-scoped list when editing their own agents, with no leaked authorId suffix in the UI.
- `useUpdateConnection` mutation wires up the new `client.getToolProvider(...).updateConnection(...)` SDK method so connection labels can be renamed in place.
- A tool's connections now appear as **badges right on the tool card** instead of behind a "manage connections" dialog. Each badge carries an edit and a disconnect icon button (with tooltips): edit opens a small focused rename dialog, and disconnect asks for confirmation before revoking the account. Unnamed connections show an "Unnamed connection" placeholder instead of the internal connection id. Connecting a new account is now a single "Connect" button.
- New `@/domains/tool-providers/*` hooks (`useAllConnections`, `useAllProviderTools`, `useAuthorize`, `useDisconnectConnection`, `useExistingConnections`, `useIsToolProviderAdmin`, `useUpdateConnection`) and form mappers/schemas back both surfaces with shared React Query cache keys.

Stored-agent form (`schemas.ts`) gains the matching `toolProviders` field shape so save / load round-trips connections + tools alongside the rest of the agent config.
