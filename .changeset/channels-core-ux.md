---
'@mastra/core': minor
---

Improved agent channels UX:

- **Streaming text** — opt-in per-adapter `streaming` flag (`boolean | { updateIntervalMs?: number }`) that pushes the agent's text deltas into the platform message progressively via the Chat SDK.
- **Adaptive typing indicator** — the platform's typing status now reflects what the agent is doing (`is working…` at run start, `is thinking…` during reasoning, `is typing…` while generating text, `is calling {toolName}…` while a tool runs, `is saving to memory…`/`is recalling memory…` during memory work, `is requesting approval for {toolName}…` while a tool is suspended), coalesced so the platform API isn't called on every delta. Skipped while a streaming session is open since the widget itself conveys progress.
- **`toolDisplay` modes** — new `ChannelAdapterConfig.toolDisplay` controls how tool calls render:
  - `'cards'` (default) — per-tool running/result cards (unchanged behavior).
  - `'timeline'` — every tool gets its own task row in a streaming widget with status icons and args.
  - `'grouped'` — all tools in the run collapse into a single streaming widget; args fold inline into the title and successful results are suppressed for an at-a-glance summary (errors keep their full text).
  - `'hidden'` — tools run silently; only the typing indicator shows work.

  `'timeline'` and `'grouped'` require `streaming: true` and fall back to `'cards'` with a one-time warn if not enabled. Approve/deny prompts always render as a separate card regardless of mode, since inline task entries can't carry interactive buttons.
- **`typingStatus` customization** — new `ChannelAdapterConfig.typingStatus` (`boolean | (chunk, ctx) => string | false`, default `true`). Set to `false` to suppress all typing indicators (useful when a live streaming widget already conveys progress), or pass a function to set custom copy per chunk. Compose with the exported `defaultTypingStatus` helper to fall back to built-in defaults for chunks you don't handle.
- **Signal-aware message boundaries** — when a `data-user-message` signal echoes into the stream mid-reply, any in-flight text is flushed first so the agent's response renders as a new message after the user's signal instead of streaming into the prior reply.
- **Stronger stay-silent prompt** — the channel input processor's non-DM system message now explicitly calls out anti-patterns (bracketed status notes, "Got it"/"Noted" acknowledgments, apologizing for silence) and points the model at `add_reaction` for silent acknowledgments. Empty responses are framed as a first-class action rather than a fallback.
- **Parallel same-tool approval** — fixed a bug where two parallel calls to the same tool with `requireApproval: true` clobbered each other's pending entry, so only the most recent could be approved.
- **Tool error rendering** — failing tools now emit a closing task update in `'timeline'`/`'grouped'` modes (previously the row stayed `in_progress` and rendered as ⚠ at session close) and edit their card in `'cards'`/`'hidden'` modes. The error text is inlined into the task `details` (with a ⚠ glyph) while the task itself stays `status: 'complete'` so a single tool failure doesn't flip the overall plan header to an error state.
- **Observational-memory lifecycle in streaming widgets** — `data-om-buffering-*` and `data-om-activation` chunks are routed into the active streaming session in `'timeline'`/`'grouped'` modes as their own task rows (e.g. `Saved to memory (10x)` with `12.4k → 1.2k tokens`), so memory work is visible alongside tool calls.
- **Logger propagation** — the Mastra logger is now propagated into `AgentChannels` on register so channel-level logs flow through the configured logger.
- **Internal refactor (no public API change)** — `consumeAgentStream` now dispatches to one of two focused drivers (streaming vs static) instead of switching on `toolDisplay` inside a single 700-line loop. Tool-call correlation moved into a `ToolTracker` helper and observational-memory rendering into a dedicated `renderOmTaskUpdate` helper, both shared between drivers. Invalid combinations now warn and downgrade: `streaming: true` + `toolDisplay: 'cards'` falls back to `'timeline'`; `streaming: false` + `'timeline'`/`'grouped'` falls back to `'cards'`.

```ts
import { Agent } from '@mastra/core/agent';
import { defaultTypingStatus } from '@mastra/core/channels';

const agent = new Agent({
  name: 'support-bot',
  channels: {
    slack: {
      streaming: true,
      toolDisplay: 'grouped', // 'cards' | 'timeline' | 'grouped' | 'hidden'
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
    },
  },
});
```
