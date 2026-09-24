---
'@mastra/connect': minor
'@mastra/telegram': minor
---

Added `channels()`, the second top-level function in `@mastra/connect` alongside `tools()`. It resolves each channel-capable project connection into a first-party `ChannelProvider` instance and returns the `Record<string, ChannelProvider>` shape `new Mastra({ channels })` already accepts — one line at Mastra construction replaces per-provider `new SlackProvider(...)` / `new TelegramProvider(...)` / `new DiscordProvider(...)` wiring and hardcoded tokens.

```ts
import { Mastra } from '@mastra/core/mastra';
import { Agent } from '@mastra/core/agent';
import { tools, channels } from '@mastra/connect';

const pat = new Agent({
  id: 'pat',
  name: 'Pat',
  instructions: 'You are Pat.',
  model: openai('gpt-4o'),
  tools: tools({ projectId }),
});

export const mastra = new Mastra({
  agents: { pat },
  channels: await channels({ projectId }),
});
```

Launch ships three providers, each wrapping the corresponding first-party channel package so consumers get the full install / OAuth / webhook lifecycle for free:

- `slack` — `@mastra/slack`
- `telegram` — `@mastra/telegram`
- `discord` — `@mastra/discord`

Peer packages are declared as optional `peerDependencies` and imported lazily inside `channels()`; install only the ones you use, and a missing peer is downgraded to a warn-and-skip so the rest of the provider map keeps working.

`channels()` mirrors `tools()` / `environment()`: same `projectId` / `client` / `integrations` shape, TTL cache with stale-serve on outage, and `invalidate()` / `refresh()` / `disconnect()` handles on the resolver. Per-integration options accept `connectionId` (pin), `disabled: true` (exclude), and `providerOptions` (merged into the `ChannelProvider` constructor call). The resolver is callable, thenable (`await channels({...})` yields the map directly), and thread-safe for reuse across constructions.

Connection selection is deterministic: a pinned `connectionId` wins, otherwise the single active connection is used. When more than one active connection matches an integration, `channels()` **warns and uses the first active connection** (naming the chosen id and every id it's ignoring); there is no `MASTRA_*_CONNECTION_ID` env-var fallback for channels. Pin explicitly to silence the warning. `Mastra({ channels })` reads the resolved map synchronously at construction — the running Mastra won't pick up connections added later or rotated credentials without a restart, so `.invalidate()` / `.refresh()` are scoped to standalone/test usage.

`providerOptions` rejects reserved fields at both the type level and at runtime: credentials (`refreshToken`, `token`, `botToken`) and framework-managed settings (`baseUrl`, `apiBaseUrl`, `encryptionKey`) can't be threaded through `channels()`. Credentials are managed by the platform connection; `baseUrl` is set by the Mastra server; `encryptionKey` is process-wide. Passing any of them is a compile-time error, and a runtime cast that bypasses the check is stripped with a warning. Discord's `applicationId` and `publicKey` are **not** reserved and can be supplied via `providerOptions` when the connection doesn't carry them.

Also renames `connect()` → `tools()` and `PROVIDERS` → `TOOLS`. The old names are re-exported as `@deprecated` aliases for one release cycle so existing code keeps building. Migration is a straight rename:

```diff
- import { connect, PROVIDERS } from '@mastra/connect';
- const agentTools = connect({ projectId });
+ import { tools, TOOLS } from '@mastra/connect';
+ const agentTools = tools({ projectId });
```

`@mastra/telegram`'s `TelegramProviderConfig` now accepts an optional `botToken` at construction (matching `SlackProvider` / `DiscordProvider`). When set, per-agent `provider.connect(agentId)` calls fall back to it so the bot token can be supplied once at construction instead of at every call site. Explicit `provider.connect(agentId, { botToken: '...' })` still overrides. `TelegramProvider.configure({ botToken })` is a runtime alias for the same field.
