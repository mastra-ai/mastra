# Slack (Mastra Code plugin)

Read (and optionally write) Slack **as your own user account** from Mastra Code. Auth is a PKCE
user-token OAuth flow against a pre-existing Slack app via `SlackUserAuth` from `@mastra/slack` —
no bot install, no webhooks, no infra. Tools act as you: anything you can see in Slack, the agent
can read.

## Install

The plugin links `@mastra/slack` from this repo, so build it first:

```sh
pnpm turbo build --filter ./channels/slack
cd mastracode/plugins/slack
pnpm install --ignore-workspace
pnpm check
```

Then in Mastra Code: `/plugins` → Install new plugin → Local path → `mastracode/plugins/slack`.

## Connect

Configure a Slack app `client_id` (PKCE public client) via plugin config or the
`MASTRA_SLACK_CLIENT_ID` env var, then ask the agent to run `slack_connect`. A browser window opens
for authorization; credentials persist at `~/.mastra/slack-auth.json` (0600) with rotation-safe
refresh — Slack rotates the refresh token on every refresh and each rotation is persisted before
the new token is used.

## Tools

Read (always on): `slack_search`, `slack_fetch_channel_messages`, `slack_fetch_thread`,
`slack_fetch_messages`, `slack_list_threads`, `slack_get_thread_participants`,
`slack_get_channel_info`, `slack_get_user`, plus `slack_connect` / `slack_status` /
`slack_disconnect`.

Write (enable the `readWrite` config option, then reconnect to grant write scopes):
`slack_post_message`, `slack_post_channel_message`, `slack_send_direct_message`,
`slack_add_reaction`.

ID formats follow chat-sdk conventions: channel `slack:C…`, thread `slack:C…:<ts>`, user raw `U…`.

## Relationship to other Slack pieces

- `SlackProvider` (`@mastra/slack` channels): **bot identity**, webhook-driven, needs a public
  endpoint. This plugin is **user identity**, outbound-only, zero infra.
- `SlackSignals` (planned): polling signal provider that wakes agents on subscribed threads,
  built on the same `SlackUserAuth`.
