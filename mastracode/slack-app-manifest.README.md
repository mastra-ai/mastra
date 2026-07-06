# Mastra Code — Slack app manifest

`slack-app-manifest.json` is the checked-in source of truth for the
**Mastra-published Slack app** ("Mastra Code") that powers the `/slack`
integration. mastracode never asks users to create their own app; it ships the
resulting public `client_id` and drives an OAuth 2.0 + PKCE loopback flow
against this app.

## What this app must be

- **Public client (PKCE)** — `oauth_config.pkce_enabled: true`. This lets
  desktop/CLI clients authenticate **without a client secret**. mastracode ships
  no secret. ⚠️ Enabling this is a **one-way** change on the Slack app; it cannot
  be reverted without Slack support. (It can also be toggled in the dashboard
  under OAuth & Permissions → Advanced options → Proof Key for Code Exchange.)
- **MCP enabled** — `settings.is_mcp_enabled: true`, so the app can be used with
  Slack's remote MCP server at `https://mcp.slack.com/mcp`.
- **Bot user** — `features.bot_user` plus a `bot` scope (`users:read`). Slack's
  user-token authorize endpoint requires the app to declare a bot user even
  though the MCP server only uses the resulting user token.
- **Token rotation** — `settings.token_rotation_enabled: true`. PKCE forces
  refresh tokens to **expire in 30 days**; mastracode refreshes silently via
  `AuthStorage` (`getApiKey` auto-refreshes on expiry).
- **Loopback redirects** — `oauth_config.redirect_urls` lists the localhost
  ports mastracode's loopback callback server binds to. These **must** match the
  ports in `src/slack/oauth.ts`. Changing them requires a manifest update **and**
  re-publishing the app.

## Scopes are a superset

`oauth_config.scopes.user` is the **full superset** of user-token scopes the app
can grant. mastracode's permission-level presets in `src/slack/scopes.ts` request
a subset of these depending on the level the user picked (`read-only`,
`read-write`, `full`). The `SLACK_MANIFEST_USER_SCOPES` constant in that file
mirrors this list, and a unit test asserts every preset scope appears here. **If
you add a scope to a preset, add it here and re-publish the app first.**

## Publishing / updating

1. Create or update the app from this manifest in the Slack app dashboard
   (Settings → "App Manifest"), or via the Slack CLI.
2. Confirm PKCE and MCP are enabled (set by `oauth_config.pkce_enabled` and
   `settings.is_mcp_enabled` in the manifest; verify on the OAuth & Permissions
   page).
3. Distribute the app so workspace admins can approve it — **Slack MCP requires
   workspace-admin approval** before members can connect.
4. Copy the app's **Client ID** into `src/slack/client-id.ts`
   (`MASTRA_SLACK_CLIENT_ID`) or provide it at runtime via the
   `MASTRACODE_SLACK_CLIENT_ID` env var. There is **no client secret**.

## BYO app

Restricted orgs that cannot use the shared app can point mastracode at their own
PKCE public app with the identical flow via `SlackSettings.clientId` or
`/slack connect --byo <client_id>`. Their app must mirror this manifest
(public client + MCP + matching redirect URLs).
