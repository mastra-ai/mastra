---
'@mastra/connect': minor
---

Improved error handling across all providers and updated the Clerk tools, verified by a new live end-to-end test suite that exercises every tool of all 26 checked-in providers.

**Clearer error messages** — errors returned as `{ errors: [{ message, long_message }] }` (Clerk, Linear, and other providers) now surface the human-readable message instead of a generic failure.

**Fixed error recovery in generated tools** — `MastraConnectError` now also exposes its HTTP status as `error.response.status`. Generated tools check this field in their error handlers (for example the create-vs-update fallback in `github_create_or_update_file`), which previously never matched and failed instead of recovering.

**Updated Clerk tools** (regenerated from the upstream template fix, NangoHQ/integration-templates#670):

- `clerk_list_sessions` now requires `client_id` or `user_id` and no longer returns `total`.
- `clerk_create_user` now requires at least one identifier (`email_address`, `phone_number`, or `username`).
- `clerk_list_users` now returns an accurate `total`.

```ts
// Before: accepted by the schema, then rejected by the Clerk API
await toolset.clerk_list_sessions.execute({ status: 'active' });

// After: the input schema requires a client or user filter
await toolset.clerk_list_sessions.execute({ user_id: 'user_123', status: 'active' });
```
