# @mastra/discord

Discord channel wrapper for Mastra — a `ChannelProvider` (`@mastra/core/channels`) over **[`@chat-adapter/discord`](https://www.npmjs.com/package/@chat-adapter/discord)** (pinned to `4.34.0`), to parity with `@mastra/slack`.

The adapter already handles the Discord protocol (Ed25519 request verification, PING/PONG, deferrals, embeds + action-row buttons, the Gateway bridge, post-and-edit streaming). This package adds the install/lifecycle layer: the app-config + guild-keyed install store, an OAuth2 bot-invite `connect()`, guild/global slash-command registration, and Mastra route/stream wiring.

**Shape (how Discord differs from Slack/Telegram):** Discord has **no programmatic app creation** — apps are made in the Developer Portal. So there is no per-agent app factory: it's **one app, many guilds**. "Installing" is a **bot invite** (an OAuth2 authorize URL), not a token exchange — there is no per-install token to store. One bot token per application is reused across every guild, and tenancy is keyed by `guildId` per interaction.

## Install

```bash
npm install @mastra/discord
# peer: @mastra/core >= 1.22
```

## Usage

```ts
import { Mastra } from '@mastra/core'
import { DiscordProvider } from '@mastra/discord'

const discord = new DiscordProvider({
  // From the Developer Portal. Or set DISCORD_BOT_TOKEN / DISCORD_PUBLIC_KEY /
  // DISCORD_APPLICATION_ID in the environment and omit this.
  app: {
    botToken: process.env.DISCORD_BOT_TOKEN!,
    publicKey: process.env.DISCORD_PUBLIC_KEY!,
    applicationId: process.env.DISCORD_APPLICATION_ID!,
  },
  baseUrl: 'https://your-app.example.com', // for the interactions endpoint; auto-detected from the Mastra server if omitted
})

export const mastra = new Mastra({
  agents: { support },
  channels: { discord },
})

// Returns the OAuth2 bot-invite URL — open it and pick a server:
const result = await discord.connect('support')
// → { type: 'oauth', authorizationUrl: 'https://discord.com/oauth2/authorize?...', installationId: '...' }
```

See [`example/discord-agent.ts`](./example/discord-agent.ts) for a full runnable sketch.

## Developer Portal setup

Discord apps are created in the [Developer Portal](https://discord.com/developers/applications), not via API. Once:

1. **Application** → copy the **Application ID** and **Public Key** (General Information).
2. **Bot** → add a bot, copy its **token**. Enable the **Message Content** / **Server Members** intents if you use DMs/mentions over the Gateway.
3. **Interactions Endpoint URL** → set it to `${baseUrl}/discord/events/<webhookId>` (the `webhookId` comes back from `connect()` / `listInstallations()`). Discord sends a signed test PING on save; the adapter answers it — don't rewrite the response.

## The connect flow

`connect(agentId, options?)` returns a discriminated `ChannelConnectResult`:

| Call | Result | Meaning |
| --- | --- | --- |
| `connect(id)` | `{ type: 'oauth', authorizationUrl }` | Open the URL, pick a server, authorize. The guild activates on the first interaction. |
| `connect(id, { guildId })` where the bot is **already** in `guildId` | `{ type: 'immediate' }` | Bound instantly; the guild's commands are registered. |
| `connect(id, { guildId })` where it is **not** | `{ type: 'oauth', authorizationUrl }` | Falls back to the invite URL. |

The bot-invite URL *is* an OAuth2 authorize URL (`scope=bot applications.commands` + a `permissions` bitfield), so completion is a browser redirect — hence the `oauth` variant. Re-connecting an already-active agent throws (disconnect first). To add another server, invite the bot with the existing URL — **new guilds activate on their first interaction** off the interaction's authoritative `guild_id`.

Credentials are validated (`GET /applications/@me`) **before** anything is persisted, so a bad token leaves no config or install behind. The bot token is the only secret; with an `encryptionKey` set it is AES-256-GCM encrypted at rest.

## Routing & the raw-body contract

The provider mounts **one** route, `POST /discord/events/:webhookId` (`requiresAuth: false` — Discord authenticates with Ed25519, not a bearer token). The handler passes the **raw request bytes** straight to `adapter.handleWebhook`; Ed25519 verification and PING/PONG live in the adapter.

> ⚠️ The Ed25519 signature is over `timestamp + raw body bytes`. Any middleware that parses and re-serializes the body (a JSON body-parser, `c.req.json()` then re-stringify) mutates the bytes and **every** signature fails. Don't put one in front of this route.

The mounted route only ever receives HTTP **Interactions** (PING, slash commands, buttons). DMs, @mentions and reactions arrive over the **Gateway**.

## The Gateway is core's job

For each adapter with `gateway !== false` (default `true`), `@mastra/core` owns the persistent Gateway WebSocket + its reconnection loop (`AgentChannels` → `startGatewayLoop`). This wrapper just sets `gateway: true` on the adapter entry — it never calls `startGatewayListener` and never runs a reconnect loop. Set `gateway: false` for serverless deployments that only need slash commands over HTTP.

Because core owns the loop (there is no `stopGatewayListener`), `disconnect()` removes the install row and drops the adapter entry but **cannot** kill an in-flight Gateway window — it lapses at the next duration boundary.

### Known caveat: reactions on a thread's starter message

An @mention in a channel opens a **new thread**, and Discord gives that thread an id equal to the starter message's id. The pinned `@chat-adapter/discord@4.34.0` resolves a reaction's target channel as `threadId || channelId`, so it `PUT`s to `/channels/{threadId}/messages/{messageId}/reactions/…` and Discord answers **404 `Unknown Message` (code 10008)** — the starter message is not a message *inside* the thread, it is the message the thread hangs off. Upgrading does not help: the code is unchanged through `4.37.0`, the current release.

Effect: an `add_reaction` on that message does not appear, and the 404 is logged. **Replies are unaffected** — `AgentChannels` suppresses `tool-error` chunks for its own channel tools, so the agent's response still posts. Pass `tools: false` to stop offering the reaction tools if the logged errors are noise for you.

This is in the protocol adapter, not this provider.

## Commands

Slash commands default to a single `/help` seed. Override per agent or provider-wide:

```ts
await discord.connect('support', {
  commands: ['/help', { name: 'ask', description: 'Ask a question' }],
})
```

Names are normalized to Discord's constraints (lowercase `[a-z0-9_-]`, 1-32 chars; description 1-100). Registration is scoped by `commandScope`:

- `'guild'` (default) — `PUT …/guilds/{id}/commands`, updates **instantly**, registered on each first-seen guild.
- `'global'` — `PUT …/commands`, eventually consistent, registered **once**.

Discord allows only **200 command creates per day, per guild**, so a per-scope content hash is tracked on the install and an unchanged command set is **not** re-registered.

## Streaming & ephemeral

Discord has no native token streaming. With `streaming: true` (default) the reply chunk-edits the interaction followup via the adapter's `editMessage` loop — throttle it with `streaming: { updateIntervalMs }` (Discord rate-limits edits). `typingStatus: true` (default) keeps a typing indicator alive. `toolDisplay` defaults to `'cards'` (Discord has native embeds + action-row buttons).

The deferred type-5 ACK is sent synchronously inside the 3-second window; the agent then runs in the background (under `waitUntil`) and posts into the 15-minute followup window. Ephemeral replies (flag 64) are locked at defer time — decide them via the `interactionFlags` callback (fired on the initial deferred response).

## Configuration

`new DiscordProvider(config)`:

| Option | Default | Notes |
| --- | --- | --- |
| `app` | `DISCORD_*` env | `{ botToken, publicKey, applicationId }`. Persisted once to channels storage. |
| `baseUrl` | Mastra server config | Public HTTPS base for the interactions endpoint. |
| `storage` | Mastra channels storage, else in-memory | Install persistence (`ChannelsStorage`). |
| `encryptionKey` | `MASTRA_ENCRYPTION_KEY` env | Encrypts the stored `botToken` at rest with AES-256-GCM when set; otherwise it is stored in plaintext. |
| `apiBaseUrl` | `https://discord.com/api/v10` | Override the REST origin (e.g. a test mock). |
| `permissions` | read/reply/embed/react bitfield | Invite-URL permissions (`bigint` or decimal string). |
| `commands` | `/help` | Default command seed. |
| `commandScope` | `'guild'` | `'guild'` \| `'global'`. |
| `gateway` | `true` | Start the core-owned Gateway loop (DMs/@mentions/reactions). |
| `streaming` | `true` | Post-and-edit reply streaming (`{ updateIntervalMs }` to tune). |
| `typingStatus` | `true` | Typing keepalive. |
| `toolDisplay` | `'cards'` | How tool calls render (Discord has native embeds/buttons). |
| `mentionRoleIds` | `DISCORD_MENTION_ROLE_IDS` env | Roles that trigger mention handlers. |
| `interactionFlags` | — | Return flags (e.g. ephemeral) for the initial deferred response. |
| `waitUntil` | — | Keep serverless invocations alive (Vercel/Lambda). |

### AgentChannels passthrough

These forward to the agent's `AgentChannels` (the same curated subset `@mastra/slack` exposes); each falls back to anything the agent author already configured:

| Option | Notes |
| --- | --- |
| `handlers` | Override `onDirectMessage` / `onMention` / `onSubscribedMessage`. |
| `inlineMedia` | Which media types are sent inline to the model. |
| `inlineLinks` | Promote URLs in messages to file parts. |
| `tools` | Expose reaction tools (`add_reaction`/`remove_reaction`). Default on. |
| `state` | State adapter for dedup, locking, subscriptions. |
| `threadContext` | Fetch recent messages when joining a thread mid-conversation. |
| `chatOptions` | Passthrough to the underlying Chat SDK. |
| `resolveResourceId` | Choose memory ownership for a thread. |
| `cors` / `formatError` / `logger` | Interactions-route CORS, error rendering, adapter logger. |
| `resolveWaitUntil` | Resolve `waitUntil` from the request context. |
| `onInstall` | Called after an agent connects and the install is persisted. |

## Module format

Dual **ESM + CJS**, mirroring `@mastra/slack`. The ESM-only `@chat-adapter/discord` is kept external in the ESM build but bundled into the CJS output, so both `import` and `require('@mastra/discord')` work.

## Development

```bash
npm install
npm run typecheck
npm test        # vitest, undici-mocked Discord REST + a signed Ed25519 PING→PONG
npm run build   # tsup → dist (ESM + CJS + d.ts)
```

## License

Apache-2.0
