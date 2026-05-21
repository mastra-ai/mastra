---
'@mastra/core': minor
---

Improved agent channels UX:

- **Streaming text** — opt-in per-adapter `streaming` flag (`boolean | { updateIntervalMs?: number }`) that pushes the agent's text deltas into the platform message progressively via the Chat SDK.
- **Adaptive typing indicator** — the platform's typing status now reflects what the agent is doing (`Typing…` while generating text, `Calling {toolName}…` while a tool runs), coalesced so the platform API isn't called on every delta.
- **`toolDisplay` modes** — new `ChannelAdapterConfig.toolDisplay` controls how tool calls render:
  - `'cards'` (default) — per-tool running/result cards (unchanged behavior).
  - `'timeline'` — every tool gets its own task row in a streaming widget with status icons and args.
  - `'grouped'` — all tools in the run collapse into a single streaming widget; args fold inline into the title and successful results are suppressed for an at-a-glance summary (errors keep their full text).
  - `'hidden'` — tools run silently; only the typing indicator shows work.

  `'timeline'` and `'grouped'` require `streaming: true` and fall back to `'cards'` with a one-time warn if not enabled. Approve/deny prompts always render as a separate card regardless of mode, since inline task entries can't carry interactive buttons.
- **`typingStatus` opt-out** — new `ChannelAdapterConfig.typingStatus` (`boolean`, default `true`) lets adapters suppress all platform typing indicators. Useful when a live streaming widget already conveys progress.
- **Signal-aware message boundaries** — when a `data-user-message` signal echoes into the stream mid-reply, any in-flight text is flushed first so the agent's response renders as a new message after the user's signal instead of streaming into the prior reply.
- **Stronger stay-silent prompt** — the channel input processor's non-DM system message now explicitly calls out anti-patterns (bracketed status notes, "Got it"/"Noted" acknowledgments, apologizing for silence) and points the model at `add_reaction` for silent acknowledgments. Empty responses are framed as a first-class action rather than a fallback.
- **Parallel same-tool approval** — fixed a bug where two parallel calls to the same tool with `requireApproval: true` clobbered each other's pending entry, so only the most recent could be approved.
- **Logger propagation** — the Mastra logger is now propagated into `AgentChannels` on register so channel-level logs flow through the configured logger.

```ts
import { Agent } from '@mastra/core/agent';

const agent = new Agent({
  name: 'support-bot',
  channels: {
    slack: {
      streaming: true,
      toolDisplay: 'grouped', // 'cards' | 'timeline' | 'grouped' | 'hidden'
      typingStatus: false, // suppress typing indicator when the widget already shows progress
    },
  },
});
```
