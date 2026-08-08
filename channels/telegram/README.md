# @mastra/telegram

Telegram channel wrapper for Mastra — a `ChannelProvider` (`@mastra/core/channels`) over **[`@chat-adapter/telegram`](https://www.npmjs.com/package/@chat-adapter/telegram)** (`^4.34.0`, aligned with the `@chat-adapter/*` version the monorepo builds against), to parity with `@mastra/slack`.

The adapter already handles the Bot API transport (webhook parse, send/edit, typing, rich messages, inline keyboards). This package adds the install/lifecycle layer: a multi-bot token store, `setWebhook` + secret-token verification, `setMyCommands`, and Mastra route/stream wiring.

**Shape (how Telegram differs from Slack):** no OAuth, no Ed25519, no app-factory. The BotFather token _is_ the credential — one token per bot, one bot per agent.

## Install

```bash
npm install @mastra/telegram
# peer: @mastra/core — channels require >= 1.22.0
```

## Usage

```ts
import { Mastra } from '@mastra/core';
import { TelegramProvider } from '@mastra/telegram';

const telegram = new TelegramProvider({
  baseUrl: 'https://your-app.example.com', // for setWebhook; auto-detected from the Mastra server if omitted
});

export const mastra = new Mastra({
  agents: { support },
  channels: { telegram },
});

// Paste a BotFather token to connect an agent instantly:
const result = await telegram.connect('support', { botToken: process.env.TELEGRAM_BOT_TOKEN });
// → { type: 'immediate', installationId: '...' }
```

## The connect flow

`connect(agentId, options?)` returns a discriminated `ChannelConnectResult` — Telegram never uses OAuth:

| Call                        | Result                                                 | Meaning                                                                                 |
| --------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `connect(id, { botToken })` | `{ type: 'immediate' }`                                | Token validated via `getMe`; the bot is live.                                           |
| `connect(id)`               | `{ type: 'deep_link', url: 'https://t.me/botfather' }` | No token yet — open BotFather, run `/newbot`, then call `connect` again with the token. |

`connect` is idempotent per agent: a pending install upgrades to active (same id/webhook) when the token arrives, and re-connecting an already-active agent throws (disconnect first). **One bot = one agent.**

## Webhook vs polling

Setting a webhook and long-polling `getUpdates` are mutually exclusive; the provider manages the switch per bot via the `mode` option:

- `auto` (default) — webhook when a `baseUrl` is available, otherwise polling.
- `webhook` — register `setWebhook` (requires a `baseUrl`).
- `polling` — clear any webhook first, then long-poll.

In polling mode the adapter's `getUpdates` loop starts automatically once the agent is wired (tune it with `longPolling`); `disconnect()` stops it.

In webhook mode the provider mounts one route, `POST /telegram/events/:webhookId`, and verifies the `X-Telegram-Bot-Api-Secret-Token` header (constant-time) on **every** request before delegating to the agent. The per-bot secret is generated automatically and never travels in the URL.

## Commands

Commands are published via `setMyCommands` and default to the conventional `/start` `/help` `/settings` seed. Override per agent or provider-wide:

```ts
await telegram.connect('support', {
  botToken,
  commands: ['/ask', { command: 'summarize', description: 'Summarize a link' }],
});
```

Names are normalized to the Bot API constraints (lowercase `[a-z0-9_]`, 1-32 chars; description 1-256).

## Streaming

Telegram has no native token streaming. With `streaming: true` (default) the reply is chunk-edited via `editMessageText` (4096-char cap handled by the adapter), and `typingStatus: true` (default) keeps a `sendChatAction` indicator alive. Set either to `false` to disable.

## Configuration

`new TelegramProvider(config)`:

| Option           | Default                                                                 | Notes                                                                                                    |
| ---------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `baseUrl`        | Mastra server config                                                    | Public HTTPS base for `setWebhook`.                                                                      |
| `storage`        | Mastra channels storage, else in-memory                                 | Installation persistence (`ChannelsStorage`).                                                            |
| `encryptionKey`  | `MASTRA_ENCRYPTION_KEY` env                                             | Encrypt `botToken`/`secretToken` at rest (AES-256-GCM).                                                  |
| `apiBaseUrl`     | `https://api.telegram.org`                                              | Override for a self-hosted Bot API server.                                                               |
| `mode`           | `auto`                                                                  | `auto` \| `webhook` \| `polling`.                                                                        |
| `allowedUpdates` | message, edited_message, channel_post, callback_query, message_reaction | Passed to `setWebhook`.                                                                                  |
| `longPolling`    | adapter defaults                                                        | Poll-loop tuning (`timeout`, `limit`, `retryDelayMs`…) for polling mode.                                 |
| `commands`       | `/start /help /settings`                                                | Default command seed.                                                                                    |
| `commandScope`   | Telegram default                                                        | `BotCommandScope` for `setMyCommands`.                                                                   |
| `streaming`      | `true`                                                                  | Post-and-edit reply streaming.                                                                           |
| `typingStatus`   | `true`                                                                  | Typing keepalive.                                                                                        |
| `toolDisplay`    | `'text'`                                                                | How tool calls render. Telegram has no Block Kit, so `'cards'`/`'grouped'`/`'timeline'` degrade to text. |
| `waitUntil`      | —                                                                       | Keep serverless invocations alive (Vercel/Lambda).                                                       |

### AgentChannels passthrough

These forward to the agent's `AgentChannels` (the same curated subset `@mastra/slack` exposes); each falls back to anything the agent author already configured:

| Option                            | Notes                                                                    |
| --------------------------------- | ------------------------------------------------------------------------ |
| `handlers`                        | Override `onDirectMessage` / `onMention` / `onSubscribedMessage`.        |
| `inlineMedia`                     | Which media types are sent inline to the model (Telegram photos, PDFs…). |
| `inlineLinks`                     | Promote URLs in messages to file parts.                                  |
| `tools`                           | Expose reaction tools (`add_reaction`/`remove_reaction`). Default on.    |
| `state`                           | State adapter for dedup, locking, subscriptions.                         |
| `threadContext`                   | Fetch recent messages when joining a thread mid-conversation.            |
| `chatOptions`                     | Passthrough to the underlying Chat SDK.                                  |
| `resolveResourceId`               | Choose memory ownership for a thread.                                    |
| `cors` / `formatError` / `logger` | Webhook-route CORS, error rendering, adapter logger.                     |
| `resolveWaitUntil`                | Resolve `waitUntil` from the request context.                            |
| `onInstall`                       | Called after an agent connects and the install is persisted.             |

## Formatting & interactivity

Message rendering is owned by the adapter, not this provider — so there is no double-escaping to worry about:

- **MarkdownV2** — the adapter emits `parse_mode: MarkdownV2` with context-aware escaping. Return `{ raw: '…' }` from a card to ship a pre-escaped string yourself.
- **Inline keyboards** — supported via the adapter's card buttons. Telegram caps `callback_data` at **64 bytes**, so keep button ids/values short; rich elements beyond buttons render as fallback text.
- **Reactions** — enabled through `tools` (`add_reaction`/`remove_reaction`); `message_reaction` updates are requested by default.

## Module format

Dual **ESM + CJS**. `@chat-adapter/telegram` is ESM-only (its `exports` declares only an `import` condition), and tsup externalises `dependencies` by default — so the adapter is kept external in the ESM build (lean, deduped) but bundled into the CJS output via `noExternal`. Both `import` and `require('@mastra/telegram')` therefore work. See `tsup.config.ts` for why this intentionally differs from `channels/slack`.

## Development

```bash
pnpm install
pnpm --filter @mastra/telegram typecheck
pnpm --filter @mastra/telegram test    # vitest, undici-mocked Bot API
pnpm --filter @mastra/telegram build   # tsup → dist
```

## License

Apache-2.0
