---
'@internal/playground': patch
---

Add Studio UI for v1 ToolProvider integrations:

- New `/integrations` page lists configured providers and per-toolkit connections, with an OAuth authorize/disconnect flow and admin-grouped author rows.
- Inline `IntegrationConnectionPicker` in the Agent Builder tools view so a Connect on a tool card auto-checks the tool and pins the freshly authorized connection.
- Builder picker is scoped to the caller's `authorId` by default — admins see the same self-scoped list when editing their own agents, with no leaked authorId suffix in the UI.
- `useUpdateConnection` mutation wires up the new `client.getToolProvider(...).updateConnection(...)` SDK method so connection labels can be renamed in place.
- New `@/domains/tool-providers/*` hooks (`useAllConnections`, `useAllProviderTools`, `useAuthorize`, `useDisconnectConnection`, `useExistingConnections`, `useIsToolProviderAdmin`, `useUpdateConnection`) and form mappers/schemas back both surfaces with shared React Query cache keys.

Stored-agent form (`schemas.ts`) gains the matching `toolProviders` field shape so save / load round-trips connections + tools alongside the rest of the agent config.
