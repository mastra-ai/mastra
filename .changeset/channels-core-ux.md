---
'@mastra/core': minor
---

Improved agent channels UX:

- **Streaming text** — opt-in per-adapter `streaming` flag (`boolean | { updateIntervalMs?: number }`) that pushes the agent's text deltas into the platform message progressively via the Chat SDK.
- **Adaptive typing indicator** — the platform's typing status now reflects what the agent is doing (`is working…` at run start, `is thinking…` during reasoning, `is typing…` while generating text, `is calling {toolName}…` while a tool runs, `is saving to memory…`/`is recalling memory…` during memory work, `is requesting approval for {toolName}…` while a tool is suspended), coalesced so the platform API isn't called on every delta. Skipped while a streaming session is open since the widget itself conveys progress.
- **`toolDisplay` modes** — new `ChannelAdapterConfig.toolDisplay` controls how tool calls render:
  - `'cards'` (default) — per-tool running/result cards in rich Block Kit form.
  - `'text'` — per-tool running/result messages as plain text (replaces the old `cards: false` flag).
  - `'timeline'` — every tool gets its own task row in a streaming widget with status icons and args.
  - `'grouped'` — all tools in the run collapse into a single streaming widget; args fold inline into the title and successful results are suppressed for an at-a-glance summary (errors keep their full text).
  - `'hidden'` — tools run silently; only the typing indicator shows work.
  - **Function form (`ToolDisplayFn`)** — pass a function `(event, ctx) => { kind: 'post', message } | { kind: 'stream', chunk } | undefined` to fully control how every tool event renders. `'post'` results post a discrete message (closing/reopening the streaming session when needed); `'stream'` results push a `task_update`/`plan_update` into the active streaming widget; `undefined` skips the event.

  `'timeline'` and `'grouped'` require `streaming: true` and fall back to `'cards'` with a one-time warn if not enabled. `'cards'`/`'text'` work under both streaming modes — with `streaming: true`, the driver closes the streaming session around each card, posts it, and reopens on the next chunk. Approve/deny prompts always render as a separate Block Kit card regardless of mode, since inline task entries and plain text can't carry interactive buttons.

  **Deprecation**: `ChannelAdapterConfig.cards: boolean` is now deprecated and `formatToolCall` has been removed. When `toolDisplay` is not set, `cards: true` resolves to `toolDisplay: 'cards'` and `cards: false` resolves to `toolDisplay: 'text'` (with a one-time deprecation warning per platform). Migrate `cards: false` → `toolDisplay: 'text'`, and `formatToolCall: (info) => msg` → `toolDisplay: (event) => event.kind === 'result' ? { kind: 'post', message: msg } : undefined`.
- **`typingStatus` customization** — new `ChannelAdapterConfig.typingStatus` (`boolean | (chunk, ctx) => string | false`, default `true`). Set to `false` to suppress all typing indicators (useful when a live streaming widget already conveys progress), or pass a function to set custom copy per chunk. Compose with the exported `defaultTypingStatus` helper to fall back to built-in defaults for chunks you don't handle.
- **Signal-aware message boundaries** — when a `data-user-message` signal echoes into the stream mid-reply, any in-flight text is flushed first so the agent's response renders as a new message after the user's signal instead of streaming into the prior reply.
- **Stronger stay-silent prompt** — the channel input processor's non-DM system message now explicitly calls out anti-patterns (bracketed status notes, "Got it"/"Noted" acknowledgments, apologizing for silence) and points the model at `add_reaction` for silent acknowledgments. Empty responses are framed as a first-class action rather than a fallback.
- **Slack DM thread routing** — each Slack thread (including top-level DMs) now maps to its own Mastra thread. Previously, replies and tool-approval clicks in a top-level DM could be routed into a sub-thread keyed by the bot's last message, causing follow-ups to thread under that message and tool approvals to fail to find the pending approval.
- **Parallel same-tool approval** — fixed a bug where two parallel calls to the same tool with `requireApproval: true` clobbered each other's pending entry, so only the most recent could be approved.
- **Tool error rendering** — failing tools now emit a closing task update in `'timeline'`/`'grouped'` modes (previously the row stayed `in_progress` and rendered as ⚠ at session close) and edit their card in `'cards'`/`'hidden'` modes. The error text is inlined into the task `details` (with a ⚠ glyph) while the task itself stays `status: 'complete'` so a single tool failure doesn't flip the overall plan header to an error state.
- **Observational-memory lifecycle in streaming widgets** — `data-om-buffering-*` and `data-om-activation` chunks are routed into the active streaming session in `'timeline'`/`'grouped'` modes as their own task rows (e.g. `Saved to memory (10x)` with `12.4k → 1.2k tokens`), so memory work is visible alongside tool calls. Consecutive observation activations within a session coalesce into a single `Recalled memory (Nx)` row with running totals instead of stacking — reflection runs often fire several activations back-to-back. The plan title is set to `Updating memory` on the first OM event so memory-only runs don't show the chat-SDK default of `Thinking completed`. OM buffering runs async in the background, so any still-`in_progress` OM task is optimistically marked `complete` when the streaming session closes — without this, the chat-SDK plan widget would flip the "Saving to memory…" row to an error icon when the stream ends before the buffer flush resolves.
- **Logger propagation** — the Mastra logger is now propagated into `AgentChannels` on register so channel-level logs flow through the configured logger.
- **Internal refactor (no public API change)** — `consumeAgentStream` now dispatches to one of two focused drivers (streaming vs static) instead of switching on `toolDisplay` inside a single 700-line loop. Tool-call correlation moved into a `ToolTracker` helper and observational-memory rendering into a dedicated `renderOmTaskUpdate` helper, both shared between drivers. Invalid combinations now warn and downgrade: `streaming: false` + `'timeline'`/`'grouped'` falls back to `'cards'`. `streaming: true` + `'cards'`/`'text'` is now valid and uses the streaming driver's close/post/reopen lifecycle.

```ts
import { Agent } from '@mastra/core/agent';
import { defaultTypingStatus } from '@mastra/core/channels';

const agent = new Agent({
  name: 'support-bot',
  channels: {
    slack: {
      streaming: true,
      toolDisplay: 'grouped', // 'cards' | 'text' | 'timeline' | 'grouped' | 'hidden' | ToolDisplayFn
      typingStatus: false, // suppress typing indicator when the widget already shows progress
    },
    discord: {
      // Custom typing status per chunk; fall back to defaults for everything else.
      typingStatus: (chunk, ctx) => {
        if (chunk.type === 'tool-call' && chunk.payload.toolName === 'searchDocs') {
          return 'is searching docs…';
        }
        return defaultTypingStatus(chunk, ctx);
      },
      // Custom tool rendering via the function form: skip the running message,
      // post a single line on result.
      toolDisplay: event => {
        if (event.kind !== 'result') return undefined;
        return { kind: 'post', message: `🛠 ${event.toolName} → ${event.resultText}` };
      },
    },
  },
});
```
