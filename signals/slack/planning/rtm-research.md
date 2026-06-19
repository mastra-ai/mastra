# Slack RTM API Research

## Why we're here

The polling approach (enumerate all conversations → `conversations.history` per channel) doesn't scale. A user token sees ~1168 conversations (every public/private channel + a DM channel for every workspace member). Baseline pass = 1168 API calls. Subsequent polls = 1168 API calls every 30s. This is wrong.

Slack is fundamentally a push-based platform. The desktop app doesn't poll — it holds a persistent WebSocket connection and receives events as they happen.

## Three ways to receive Slack events

| | RTM API | Socket Mode | Events API (HTTP) |
|---|---|---|---|
| **Transport** | WebSocket | WebSocket | HTTP POST to webhook |
| **Token** | User (`xoxp-`) or bot (`xoxb-`) | App-level (`xapp-`) + bot (`xoxb-`) | Bot (`xoxb-`) |
| **Public URL needed** | No | No | Yes |
| **Setup complexity** | Lowest — just call `rtm.connect` | Medium — enable Socket Mode, generate app token, configure event subscriptions | High — need public endpoint, TLS, verify handshake |
| **Status** | Legacy but functional (`rtm.connect` still works) | Current recommended | Current recommended |
| **Event types** | Raw RTM events (message, im_created, etc.) | Events API events over WebSocket (same as HTTP Events API, richer) | Events API events over HTTP |
| **Interactive features** | No (messages only) | Yes (Block Kit, shortcuts, slash commands) | Yes |
| **Local dev** | Works | Works | Needs ngrok/tunnel |

## RTM API (our choice for v1)

### Why RTM

- **Simplest path for local TUI**: user token we already have → `rtm.connect` → WebSocket → receive `message` events → `notify()`. No app config changes, no app-level token, no public URL.
- **User token sees everything**: all public channels, private channels, DMs, MPIMs — exactly "watch everything."
- **Zero polling cost**: one WebSocket connection replaces 1168 HTTP requests per cycle.
- **Real-time**: events arrive as they happen, not every 30s.

### Why not Socket Mode (for now)

- Requires enabling Socket Mode in app settings (UI config change)
- Requires generating an app-level token (`xapp-`) with `connections:write` scope — a third token
- Requires configuring event subscriptions in the app dashboard
- More future-proof and supports interactive features, but more setup friction for the user
- Can migrate to Socket Mode later without changing the notification/filter/priority logic

### Why not Events API (HTTP)

- Requires a public webhook URL — not suitable for local TUI
- Same event payload as Socket Mode, just delivered over HTTP instead of WebSocket

## RTM API details

### Connection flow

1. **`rtm.connect`** — `GET` or `POST` to `https://slack.com/api/rtm.connect` with `token` param
2. Response:
   ```json
   {
     "ok": true,
     "url": "wss://wss-primary.slack.com/websocket/...",
     "self": { "id": "U061F7AUR", "name": "alice" },
     "team": { "id": "T061EG9R6", "name": "Subarachnoid Workspace", "domain": "subarachnoid" }
   }
   ```
3. **WebSocket URL is single-use, valid 30 seconds** — connect quickly
4. Connect to the WebSocket URL
5. First event: `{ "type": "hello" }` — connection established
6. Events flow as they happen

### `rtm.start` vs `rtm.connect`

- `rtm.start` is **deprecated** (as of Nov 2021 for new apps, Sep 2022 for existing)
- `rtm.start` returned a full workspace snapshot (all channels, users, etc.) — heavy payload
- `rtm.connect` returns only `url`, `self`, `team` — lightweight, use Web API for anything else
- **Use `rtm.connect` only**

### Required scopes (user token `xoxp-`)

Same scopes we already configured:
- `channels:history`, `channels:read`
- `groups:history`, `groups:read`
- `im:history`, `im:read`
- `mpim:history`, `mpim:read`
- `users:read` (for resolving user names)
- `search:read` (optional, for future search)

No additional scopes needed beyond what we already have.

### Event types we care about

#### Message events (primary)

Every new message in any channel/DM/MPIM the user can see:
```json
{
  "type": "message",
  "user": "U061F7AUR",
  "text": "How many cats did we herd yesterday?",
  "ts": "1525215129.000001",
  "channel": "C0G9QF9GZ",
  "channel_type": "channel",
  "event_ts": "1525215129.000001"
}
```

`channel_type` values: `"channel"` (public), `"group"` (private channel), `"im"` (DM), `"mpim"` (group DM), `"app_home"`

**Message subtypes** (in `subtype` field):
- `bot_message` — bot posted a message
- `me_message` — `/me` action
- `message_changed` — message edited (contains `previous_message` + `message`)
- `message_deleted` — message deleted (contains `deleted_ts`)
- `message_replied` — thread reply count updated
- `channel_join` / `channel_leave` — membership changes
- `channel_topic` / `channel_purpose` / `channel_name` — channel metadata changes
- `file_share` — file shared
- `channel_archive` / `channel_unarchive`

For v1: handle `message` (no subtype) and `bot_message`. Skip `message_changed`, `message_deleted`, etc.

#### Channel lifecycle events (secondary)

- `channel_created` — new public channel created
- `channel_archive` / `channel_unarchive`
- `im_created` — new DM channel created for the user
- `im_open` / `im_close` — DM opened/closed
- `group_open` / `group_close` — MPIM opened/closed

For v1: ignore these. We don't need to track channel state since we're receiving push events for all channels.

#### Other events (not needed for v1)

- `reaction_added` / `reaction_removed`
- `presence_change` (requires `presence_sub` subscription)
- `user_typing`
- `team_join`
- `reconnect_url` — Slack sends a fresh WebSocket URL periodically (~30s), can be used for reconnection
- `pong` — response to `ping` keepalive
- `team_migration_started` — workspace migrating, reconnect soon

### Connection lifecycle

States (from `@slack/rtm-api` SDK):
```
connecting → authenticated → connected → ready
                                    ↓
                              disconnecting → disconnected
                                    ↓
                              reconnecting → connecting (auto-reconnect)
```

- **`hello`** — first event after connecting, confirms connection established
- **`reconnect_url`** — Slack sends a new WebSocket URL; can reconnect without calling `rtm.connect` again
- **`team_migration_started`** — workspace is migrating; close socket and call `rtm.connect` again
- **Ping/pong** — send `{ "type": "ping" }`, receive `{ "type": "pong", "time": ... }` for keepalive
- **Auto-reconnect** — SDKs handle this; if implementing manually, reconnect on socket close

### Rate limits

- **Outgoing messages**: 1 per second sustained. Not relevant for us — we're read-only.
- **Incoming events**: no limit, pushed as they happen.
- **`rtm.connect` calls**: don't call repeatedly; reuse the WebSocket connection.

### WebSocket message size limit

- 16 kilobytes max per message (includes JSON syntax). Not relevant for incoming events.

### Error handling

- **Socket URL expired**: `{ "type": "error", "error": { "code": 1, "msg": "Socket URL has expired" } }` — reconnect via `rtm.connect`
- **Rate limited**: disconnect + error message
- **Network drop**: reconnect via `rtm.connect` (or `reconnect_url` if received one recently)

## Architecture for Slack Signals v1 (RTM)

### What changes

| Current (polling) | New (RTM) |
|---|---|
| `pollThread()` called on timer | WebSocket listener receives events |
| `listConversations()` → 1168 channels | Not needed — events arrive for all channels |
| `listMessages()` per channel | Not needed — each `message` event is a single message |
| High-water timestamp per channel | Not needed — dedupe by `event_ts` / `ts` |
| `maxPages: 1` baseline hack | Not needed — no baseline, just listen from connect time |
| `pollInterval` timer | Not needed — one persistent WebSocket |

### What stays the same

- `SlackSignalsProvider` class, `id`, `name`
- Subscription metadata in thread storage (`mastra.slackSignals.subscription`)
- Subscribe/unsubscribe tools and signals
- `notify()` → `sendNotificationSignal()` → notification records
- Filters (channel include/exclude, keywords, bot ignore)
- Priority rules (DM → urgent, mention → high, etc.)
- Dedupe key: `teamId:channelId:messageTs`
- `/slack` commands in mastracode TUI
- TUI statusline badge

### New components

1. **`SlackRtmClient`** — manages the RTM WebSocket connection
   - `connect(token)` → calls `rtm.connect`, opens WebSocket, starts event loop
   - `onMessage(callback)` — register handler for `message` events
   - `onEvent(type, callback)` — register handler for any event type
   - `disconnect()` — closes WebSocket
   - Auto-reconnect on disconnect (with backoff)
   - Ping/pong keepalive
   - `connected` state for TUI badge

2. **RTM event → notification mapping** in `SlackSignalsProvider`
   - On `message` event → check filters → `notify()` → notification record
   - On connect → emit "connected" status
   - On disconnect → emit "disconnected" status

3. **Lifecycle integration with SignalProvider base class**
   - `connect(agent)` → start RTM WebSocket (not `startPolling`)
   - No `pollThread` implementation needed (or empty as no-op)
   - `disconnect()` → close WebSocket
   - `isPollingThread()` → return RTM connection state

### Subscribe/unsubscribe semantics

- **Subscribe**: open RTM WebSocket (if not already open), mark thread as subscribed in metadata. Events for all channels flow to all subscribed threads.
- **Unsubscribe**: mark thread as unsubscribed in metadata. If no threads are subscribed, close RTM WebSocket.
- **On restart**: `connect()` checks if any threads have Slack subscriptions, opens RTM WebSocket if so.

### What we lose

- No historical backfill — messages before connection time are not captured (acceptable for v1)
- No `conversations.history` polling — can't catch up on missed messages during downtime (acceptable for v1)
- RTM is legacy — may be deprecated in the future (mitigated by keeping the sync client interface for future Socket Mode migration)

### What we gain

- **1 WebSocket connection** instead of 1168 HTTP requests per poll cycle
- **Real-time** — messages arrive instantly, not every 30s
- **No baseline problem** — no first-run massive API call
- **Scales with activity, not workspace size** — 10 messages = 10 events, regardless of whether you have 5 channels or 5000

## Implementation plan

### Phase 1: RTM client
- `SlackRtmClient` class using native `WebSocket` (Node 22+ has global WebSocket)
- `rtm.connect` HTTP call → get WebSocket URL → connect
- Event parsing and dispatch
- Auto-reconnect with exponential backoff
- Ping/pong keepalive (every 30s)
- Connection state tracking

### Phase 2: Wire RTM into provider
- Replace `pollThread` with RTM event handler
- `connect()` opens RTM WebSocket
- `message` event → filter → `notify()` → notification record
- `disconnect()` closes WebSocket
- Remove `listConversations`/`listMessages` from polling path (keep sync client for future use)

### Phase 3: Subscription management
- Subscribe = mark thread in metadata + ensure RTM is connected
- Unsubscribe = unmark thread + close RTM if no more subscribers
- On `connect()`, check for existing subscriptions and open RTM

### Phase 4: TUI updates
- Statusline badge shows RTM connection state (connected/reconnecting/disconnected)
- `/slack debug` shows RTM connection status, event count, uptime
- Remove polling animation (no more poll cycles)

### Phase 5: Cleanup
- Remove `pollInterval` config (or keep as unused for backward compat)
- Remove `maxMessagesPerChannel` config
- Remove `SlackWebApiSyncClient` from default path (keep for future Socket Mode / history backfill)
- Update README to document RTM approach

## Future: Socket Mode migration

When RTM is eventually deprecated, migrate to Socket Mode:
- Requires app-level token (`xapp-`) with `connections:write`
- Requires enabling Socket Mode in app settings
- Requires configuring event subscriptions (`message.channels`, `message.groups`, `message.im`, `message.mpim`)
- Uses `connections.open` instead of `rtm.connect`
- Event payload is Events API format (wrapped in envelope with `envelope_id`)
- Must acknowledge each envelope with `{ envelope_id }` response
- Same event types, just different wrapper

The notification/filter/priority logic stays identical — only the transport layer changes.

## References

- [RTM API docs](https://api.slack.com/rtm)
- [Legacy RTM API docs](https://docs.slack.dev/legacy/legacy-rtm-api)
- [rtm.connect method reference](https://docs.slack.dev/reference/methods/rtm.connect)
- [rtm.start deprecation changelog](https://docs.slack.dev/changelog/2021-10-rtm-start-to-stop)
- [@slack/rtm-api Node SDK](https://docs.slack.dev/tools/node-slack-sdk/rtm-api)
- [Socket Mode blog post](https://slack.com/blog/developers/socket-to-me)
- [Socket Mode client docs](https://docs.slack.dev/tools/python-slack-sdk/socket-mode)
- [Slack tokens documentation](https://docs.slack.dev/authentication/tokens)
- [Real-time Messaging engineering blog](https://slack.engineering/real-time-messaging)
