# Channels

`mastra.channels` providers (Slack here) surface on the Infrastructure page and via the `connectChannel` client tool inside Builder chats. PR #16161 ships the Slack frontend; #16170 ships the tool.

## Source-of-truth

In the scaffolded project's `src/mastra/index.ts`:

```ts
channels: {
  slack: new SlackProvider({ baseUrl: process.env.MASTRA_BASE_URL }),
}
```

`SlackProvider.isConfigured` controls whether the provider appears in `/editor/builder/infrastructure`'s `channels` list.

## Steps

### 1. Slack with no env vars

If `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET` / etc. are unset:

```bash
curl -s "$BASE/editor/builder/infrastructure" | jq '.channels'
```

- [ ] `slack` entry is absent (filtered out by `isConfigured`)

### 2. Slack with env vars

Set `SLACK_*` env vars in `$PROJECT_DIR/.env`, restart the dev server.

```bash
curl -s "$BASE/editor/builder/infrastructure" | jq '.channels.slack // .channels[] | select(.id==\"slack\")'
```

- [ ] Slack entry present
- [ ] Config entries reflect set vars (non-null)
- [ ] No raw secret values exposed

### 3. UI: Infrastructure page shows Slack

Navigate to `/agent-builder/infrastructure`.

- [ ] Channels section lists Slack
- [ ] Shows base URL (or "Provider default")
- [ ] Provider name reads as expected ("Slack", not the class name)

### 4. `connectChannel` tool in Builder chat

In a Builder chat (e.g., the builder agent in `/agent-builder`), prompt:

> Connect Slack so my agent can post to #general.

- [ ] Agent uses the `connectChannel` tool
- [ ] Tool returns a connection URL or success state
- [ ] No raw OAuth secrets leaked into chat
- [ ] If Slack isn't configured: tool returns an actionable error pointing to env vars

### 5. Negative path

With Slack unset, ask the same question.

- [ ] Tool/agent reports Slack is unavailable
- [ ] Suggests configuring `SLACK_*` env vars

## Checklist

- [ ] Slack hidden when not configured
- [ ] Slack shown when configured; no secrets leaked
- [ ] Provider name renders cleanly
- [ ] `connectChannel` tool callable from Builder chat
- [ ] Unconfigured channel returns actionable error
