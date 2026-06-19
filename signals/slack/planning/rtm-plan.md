# Slack Signals RTM Implementation Plan

## Context

The polling approach (`conversations.list` → `conversations.history` per channel) doesn't scale. A user token sees ~1168 conversations (all channels + a DM channel for every workspace member). Each poll cycle = 1168 HTTP requests. The first baseline pass alone takes 5+ minutes.

Slack is fundamentally push-based. The desktop app uses a persistent WebSocket connection (RTM API) to receive events in real-time. We should do the same.

See `rtm-research.md` for full API details. This plan covers the implementation.

## Working Rules

- Each phase lands as one or more discrete commits.
- Before starting a new phase, the working tree should have no uncommitted changes.
- Keep each phase independently verifiable.
- Prefer narrow tests from the affected package.
- Remove debug logging instrumentation (`#log`, `appendFileSync`, `/tmp/slack-signals-debug.jsonl`) in Phase 5.
- Do not copy reference implementation code.

## What Changes

| Current (polling) | New (RTM) |
|---|---|
| `pollThread()` called on timer per thread | WebSocket receives `message` events |
| `listConversations()` → enumerate all channels | Not needed — events arrive for all channels |
| `listMessages()` per channel | Not needed — each event is a single message |
| High-water timestamp per channel | Dedupe by `teamId:channelId:ts` |
| Baseline pass (1168 API calls) | No baseline — listen from connect time |
| `pollInterval` timer | One persistent WebSocket |
| `startPollingForThread` from harness | RTM connects on `connect()`, independent of thread |

## What Stays the Same

- `SlackSignalsProvider` class, `id='slack-signals'`, `name='Slack Signals'`
- Subscription metadata in thread storage (`mastra.slackSignals.subscription`)
- Subscribe/unsubscribe tools and typed signals
- `notify()` → `sendNotificationSignal()` → notification records
- Filters (channel include/exclude, keywords, bot ignore, user ignore)
- Priority rules (DM → urgent, mention → high, channel → low)
- Dedupe key: `teamId:channelId:ts`
- `/slack` commands in mastracode TUI
- TUI statusline badge
- `SlackWebApiSyncClient` (kept for `auth.test` in subscribe flow and future use)
- `getSlackSignalsMetadata` / `setSlackSignalsMetadata` helpers

## Phase 1 — SlackRtmClient

### Build

Create `signals/slack/src/slack-rtm-client.ts`:

- `SlackRtmClient` class using native `WebSocket` (Node 22+ global)
- Constructor: `new SlackRtmClient({ token, baseUrl?, fetch? })`
- `connect()`: calls `rtm.connect` via HTTP, opens WebSocket from returned URL
- Event dispatch: parses incoming JSON, emits typed events
- `onMessage(callback)`: register handler for `message` events (all subtypes)
- `onEvent(type, callback)`: register handler for any RTM event type
- `onLifecycle(callback)`: register handler for connection state changes (`connected`, `disconnected`, `reconnecting`, `error`)
- `disconnect()`: closes WebSocket, stops keepalive
- `get connected(): boolean`: current connection state
- Auto-reconnect: on socket close, call `rtm.connect` again with exponential backoff (1s, 2s, 4s, 8s, max 30s)
- Ping/pong keepalive: send `{ "type": "ping" }` every 30s, if no pong within 10s treat as dead connection and reconnect
- Handle `reconnect_url` event: use provided URL instead of calling `rtm.connect`
- Handle `team_migration_started`: close socket and reconnect via `rtm.connect`
- Handle `hello` event: mark as connected, emit `connected` lifecycle event
- Handle `error` event: log, emit `error` lifecycle event, reconnect

Types to export:
```ts
export type SlackRtmMessageEvent = {
  type: 'message';
  user?: string;
  text?: string;
  ts: string;
  threadTs?: string;
  channel: string;
  channelType?: 'channel' | 'group' | 'im' | 'mpim' | 'app_home';
  subtype?: string;
  botId?: string;
  username?: string;
  eventTs: string;
};

export type SlackRtmLifecycleState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error';

export type SlackRtmClientOptions = {
  token: string;
  baseUrl?: string;
  fetch?: typeof fetch;
  pingIntervalMs?: number;  // default 30000
  reconnectBaseMs?: number; // default 1000
  reconnectMaxMs?: number;  // default 30000
};
```

### Verification

- Unit tests in `slack-rtm-client.test.ts` using a mock WebSocket server
- Test: `rtm.connect` HTTP call shape and URL extraction
- Test: WebSocket connection opens and receives `hello` → emits `connected`
- Test: `message` event parsed and dispatched to `onMessage` handler
- Test: disconnect closes WebSocket
- Test: auto-reconnect on socket close with backoff
- Test: ping/pong keepalive triggers reconnect on timeout

### Tests

- `signals/slack/src/slack-rtm-client.test.ts` — 6-8 tests covering connection, event dispatch, reconnection, keepalive

### Commit Guidance

- `feat: add SlackRtmClient for RTM WebSocket connection`

## Phase 2 — Wire RTM into provider

### Build

Modify `signals/slack/src/index.ts`:

1. Import `SlackRtmClient` and types
2. Add `rtmClient?: SlackRtmClient` to `SlackSignalsProviderConfig` (optional, for testing)
3. In constructor: create `#rtmClient` from options or default `new SlackRtmClient({ token })`
4. Override `connect(agent)`:
   - Call `super.connect(agent)`
   - Start RTM connection: `this.#rtmClient.connect()`
   - Register `onMessage` handler that:
     - Skips messages with `subtype` (bot_message is okay; skip message_changed, message_deleted, etc.)
     - Maps RTM message event → `SlackSignalsMessage` shape
     - Resolves channel type from `channelType` field (fallback: infer from channel ID prefix — `C`=channel, `G`=group, `D`=im, no reliable prefix for mpim)
     - Checks filters (`shouldNotifyMessage`)
     - Calls `this.notify(createSlackNotificationInput(...), target)` for each subscribed thread
   - Register `onLifecycle` handler that updates internal connection state
5. Remove `pollThread()` implementation — RTM replaces polling
6. Remove `pollInterval` assignment (or set to 0 / undefined to disable base class polling)
7. Add `get rtmConnected(): boolean` for TUI/debug
8. `disconnect()`: close RTM WebSocket if open
9. Message dispatch to threads: iterate `getSubscriptions()` and notify each subscribed thread. Since RTM events aren't thread-specific, each message event is evaluated against all subscribed threads' filters.

Key implementation detail — RTM message → notification mapping:
```ts
// RTM message event → SlackSignalsMessage
const message: SlackSignalsMessage = {
  channelId: event.channel,
  channelName: undefined, // RTM doesn't include channel name; resolve lazily or skip
  channelType: event.channelType === 'channel' ? 'public_channel'
    : event.channelType === 'group' ? 'private_channel'
    : event.channelType === 'im' ? 'im'
    : event.channelType === 'mpim' ? 'mpim'
    : 'public_channel', // fallback
  ts: event.ts,
  threadTs: event.threadTs,
  user: event.user,
  botId: event.botId,
  username: event.username,
  text: event.text,
};
```

Channel name resolution: skip for v1. The notification `sourceId` is `teamId:channelId:ts` which doesn't need the name. The summary can show `channelId` if name is unknown. Future: cache channel names from `conversations.info` on first sighting.

### Verification

- Unit tests: mock `SlackRtmClient`, verify message events → `notify()` calls
- Test: connect starts RTM and registers message handler
- Test: message event with no subtype → `notify()` called with correct notification input
- Test: message event with `message_changed` subtype → skipped
- Test: filter excludes bot messages when `ignoreBotMessages: true`
- Test: priority assigned correctly based on channel type
- Test: multiple subscribed threads each get notified
- Test: disconnect closes RTM client
- Integration test: update `slack-emulator.integration.test.ts` to use RTM if emulator supports WebSocket (if not, keep the HTTP sync client test and add a separate RTM mock test)

### Tests

- Update `signals/slack/src/index.test.ts` — add RTM wiring tests (6-8 tests)
- Keep existing subscribe/unsubscribe/metadata tests (they don't change)
- Remove polling-specific tests (`pollThreadNow` baseline tests, `listConversations`/`listMessages` tests) — these test the old polling model
- Keep `slack-client.test.ts` (sync client still used for `auth.test` in subscribe flow)

### Commit Guidance

- `feat: replace polling with RTM WebSocket for real-time message events`

## Phase 3 — Subscription management with RTM

### Build

Modify `signals/slack/src/index.ts`:

1. Subscribe flow stays mostly the same — `subscribeThreadToSlack()` calls `auth.test` to verify token and get workspace info, saves subscription to thread metadata
2. The RTM connection is workspace-level (one WebSocket for all threads), so subscribe doesn't need to do anything RTM-specific — the WebSocket is already connected from `connect()`
3. Unsubscribe: `unsubscribeThreadFromSlack()` removes subscription from metadata. If no more subscribed threads exist, the RTM connection stays open (it's cheap — one WebSocket). Optionally close it, but keeping it open means re-subscribe is instant.
4. On `connect()`: the RTM WebSocket opens unconditionally if a token is configured. Messages are only dispatched to threads that have an active subscription in metadata.
5. Message dispatch: for each incoming RTM message, iterate `getSubscriptions()` (in-memory registry from base class), check if the thread's subscription metadata allows this message (filters), and call `notify()`.

The in-memory subscription registry (from base class) is now the source of truth for "which threads get notified." The thread metadata tracks the subscription config (filters, conversation types). On `connect()`, restore in-memory subscriptions from thread metadata (same as the GitHub provider's harness-driven approach, but since RTM is not per-thread, we restore all subscriptions).

Wait — actually the base class `getSubscriptions()` returns in-memory subscriptions registered via `this.subscribe()`. We need to make sure threads that were subscribed before restart are re-registered. Options:
- Option A: On `connect()`, scan thread storage for Slack subscriptions and re-register them in-memory. (The `#restoreSubscriptions` approach we tried before.)
- Option B: Don't use the in-memory registry. Instead, on each RTM message, query thread storage for all subscribed threads and notify them. (Expensive — storage read per message.)
- Option C: Maintain a simple in-memory `Set<SlackPollingThread>` of subscribed threads, populated on subscribe and on `connect()` (restore from storage). RTM message handler iterates this set.

**Choose Option C** — simplest, no storage reads per message, and the restore-on-connect is a one-time cost.

### Verification

- Test: subscribe adds thread to in-memory set, RTM messages for that thread are dispatched
- Test: unsubscribe removes thread from set, RTM messages no longer dispatched to it
- Test: on `connect()`, threads with existing subscriptions in storage are restored to in-memory set
- Test: thread without subscription doesn't receive notifications even if RTM is connected
- Test: all subscribed threads receive the same message event

### Tests

- Update `signals/slack/src/index.test.ts` — add subscription lifecycle tests with RTM (4-5 tests)
- Update existing subscribe/unsubscribe tests to verify in-memory set behavior

### Commit Guidance

- `feat: manage RTM subscriptions with in-memory thread set and restore on connect`

## Phase 4 — TUI updates

### Build

Modify `mastracode/src/tui/commands/slack.ts`:
- `/slack debug`: show RTM connection state (`connected`, `reconnecting`, `disconnected`) instead of polling state
- Remove polling interval display (no more `pollInterval`)
- Show event count (messages received since connection) and connection uptime
- Remove `/slack poll` subcommand (no more polling to configure)

Modify `mastracode/src/tui/status-line.ts`:
- Badge shows RTM connection state: animated lavender when connected (or pulsing), dimmed when disconnected
- Remove polling animation (no more poll cycles)

Modify `mastracode/src/index.ts`:
- Remove harness wiring for `startPollingForThread` / `stopAllPolling` for Slack (RTM connects on provider `connect()`, not per-thread)
- Remove `slackPollIntervalMs` from settings (or keep as unused for backward compat — prefer remove for cleanliness)

Modify `mastracode/src/__tests__/vitest-setup.ts`:
- Update SlackSignals mock: remove `startPollingForThread`, `stopAllPolling`, `isPollingThread`; add `rtmConnected`, `disconnect`

Modify `mastracode/src/__tests__/index.test.ts`:
- Remove test that checks `startPollingForThread` called per thread
- Add test that verifies SlackSignals is in agent signals array when token is set (already exists)

### Verification

- `pnpm --filter ./mastracode check` — typecheck clean
- `pnpm --filter ./mastracode exec vitest run --reporter=dot --bail 1` — all tests pass
- Manual: `/slack debug` shows RTM connection state

### Tests

- Update slack.test.ts — remove polling-specific tests, add RTM state display tests
- Update status-line tests if badge format changes
- Update index.test.ts — remove polling harness wiring assertions

### Commit Guidance

- `feat: update TUI for RTM connection state, remove polling UI`

## Phase 5 — Cleanup

### Build

1. Remove debug instrumentation from `signals/slack/src/index.ts`:
   - Remove `#log` method
   - Remove `#logPath` field
   - Remove `appendFileSync` import
   - Remove all `this.#log(...)` calls
   - Remove `logPath` from `SlackSignalsProviderConfig`

2. Remove polling-specific code from `signals/slack/src/index.ts`:
   - Remove `pollThread()` method
   - Remove `SlackPollingThread` type (or keep if used elsewhere)
   - Remove `SlackPollResult` type
   - Remove `pollThreadNow` references (base class method, but we don't implement `pollThread` so it's a no-op)
   - Remove `maxMessagesPerChannel` config option
   - Remove `DEFAULT_SLACK_SIGNALS_POLL_INTERVAL_MS`
   - Remove `pollInterval` assignment

3. Remove unused sync client methods:
   - Keep `getWorkspace` (used in subscribe flow for `auth.test`)
   - Keep `SlackWebApiSyncClient` class (used for `auth.test`)
   - Remove `listConversations` and `listMessages` from `SlackSignalsSyncClient` interface if no longer used
   - Actually keep them — they're still useful for future history backfill and Socket Mode migration. Just remove from the active polling path.

4. Update `signals/slack/README.md`:
   - Document RTM approach
   - Remove polling documentation
   - Update "how it works" section
   - Update limitations section (no historical backfill, no missed messages during downtime)

5. Update `signals/slack/planning/plan.md` and `understanding.md` to reflect RTM architecture (or mark as superseded by this plan).

### Verification

- `pnpm --filter ./signals/slack build` — builds clean
- `pnpm --filter ./signals/slack exec vitest run --reporter=dot` — all tests pass
- `pnpm --filter ./mastracode check` — typecheck clean
- `pnpm --filter ./mastracode exec vitest run --reporter=dot --bail 1` — all tests pass
- No references to polling, `pollThread`, `listConversations`, `listMessages` in active code paths
- No references to `/tmp/slack-signals-debug.jsonl` or `appendFileSync`

### Tests

- All existing tests should pass after cleanup
- Remove tests that tested polling behavior specifically

### Commit Guidance

- `refactor: remove polling code and debug instrumentation, update docs`

## Phase 6 — Manual smoke test

### Build

No code changes. Verify the full flow works end-to-end.

### Verification

1. Start mastracode with `SLACK_USER_TOKEN` set (or token saved via `/slack token`)
2. Enable Slack signals via `/settings`
3. Run `/slack subscribe` — should connect to RTM, verify workspace
4. Check `/slack debug` — shows RTM connected, workspace info
5. Have someone send a message in a Slack channel
6. Verify notification appears in mastracode within seconds (not 30s)
7. Verify `/slack config` shows subscription
8. Run `/slack unsubscribe` — messages stop
9. Restart mastracode — subscription restored, RTM reconnects, messages flow

### Tests

- No automated tests (manual verification)

### Commit Guidance

- No commit (verification only)

## Outcome

At the end of this plan:
- Slack signals provider uses a single RTM WebSocket connection instead of polling 1168+ channels
- Messages arrive in real-time (seconds, not 30s polling intervals)
- No baseline pass — connection is instant, messages flow from connect time
- Subscribe/unsubscribe, filters, priorities, dedupe, TUI commands all work as before
- Scales with message activity, not workspace size
- No debug logging instrumentation left in code
- RTM is legacy but functional; migration path to Socket Mode documented for the future
