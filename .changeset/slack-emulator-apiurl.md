---
'@mastra/slack': patch
---

Add an optional `apiUrl` to `SlackProvider` so its Slack Web API base URL can be
overridden (OAuth token exchange, the authorize URL, and the App Manifest client).
It defaults to `https://slack.com/api`, so production behavior is unchanged — the
override exists so the provider can be pointed at a local Slack emulator for testing.

```ts
new SlackProvider({ apiUrl: 'http://127.0.0.1:54321/api' });
```

Adds CI-runnable integration tests that boot an in-process Slack emulator (no network,
no Docker) and exercise the real Slack-interacting surfaces against it: the OAuth v2
install callback, config-drift handling (agent rename / `baseUrl` change → manifest
update, app-gone → installation cleanup, no-op → no update), and an `AgentChannels`
end-to-end mention reply, asserting parity between the `SlackProvider`-activated adapter
path and a directly-configured `createSlackAdapter`.
