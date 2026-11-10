---
'@mastra/auth': patch
'@mastra/auth-auth0': patch
'@mastra/auth-clerk': patch
---

The authenticated user now has `id` set to the token's `sub` claim when the token has no `id` claim. A token that already has an `id` claim keeps it. Standard OIDC access tokens identify the user only with `sub`, so before this change Mastra treated these users as having no id.

This fixes RBAC: every protected route answered `403 Missing required permission` because the user's roles were never loaded.

It also changes which records these users see on existing HTTP routes, unless you set `mapUserToResourceId`:

- **Stored agents, skills, workspaces, and other owned records.** Lists were unfiltered before, so every user saw every record. Now each user sees their own records plus public ones, and another user's private records are no longer listed (users with an admin permission such as `agents:admin` keep the full list). Records these users create are owned by them and private by default. Records created before the upgrade have no owner and stay visible to everyone.
- **Tool-provider connections.** Per-author connections were stored under the shared `default` owner. They are now stored under the user's `sub`. Connections created before the upgrade stay under `default`, so users have to reconnect them. Shared connections are unaffected. To keep using the old connections instead, set `mapUserToResourceId: () => 'default'` on the auth provider. That puts every user back in one shared `default` resource, so it also shares memory and owned records between them; use it only if that matches how the app worked before.
- **Observability.** Feedback submitted by these users is recorded with their `sub` as the user id.
