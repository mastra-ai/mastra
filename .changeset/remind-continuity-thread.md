---
'@mastra/memory': minor
---

Give the Subconscious reminder agent one conversation per session

The reminder agent was rebuilt from scratch on every observation run with no memory of any kind, so it could not know what it had already surfaced and could not resolve a follow-up against anything it said earlier. It now generates against a persistent thread keyed to the parent session, `subconscious:<threadId>:remind`, mirroring the convention the curator and learner already use.

That thread's Memory runs observational memory with the `experimental_subconscious` key omitted rather than with `observationalMemory: false`. Omitting the key is what keeps the reminder thread from spawning a nested subconscious against the reminder agent's own conversation, while still giving it compression and reflection.

What this retains and what it costs, plainly: every reminder run now persists its full internal prompt to storage under the remind thread — the scoped knowledge candidate summaries, the current observations, the recent-message excerpts handed to the reminder agent, and the agent's reply — and that thread's own observational memory adds observation and reflection model calls per session, on by default. The remind thread's Memory resolves its model per invocation from the session's effective observational memory model, so it follows the parent configuration instead of freezing the first session's choice. There is no per-knob retention control for the reminder conversation yet; disabling the Subconscious remind extractor (or `experimental_subconscious` itself) is the off switch for both the retained data and the added model calls. If the default-on cost turns out ugly, say so — it is a config change, not a redesign.

The session owns its derived reminder conversation. `Memory.deleteThread()` on a session thread now cascades to `subconscious:<threadId>:remind` through the same path as any other thread, deleting its messages, and its observational memory records where the store supports them, so the retained reminder data does not outlive the session it belongs to. The derived thread is deleted before the parent so a failure leaves the deletion retryable instead of orphaning the reminder conversation.

The freshness guard that stops the reminder agent echoing knowledge just captured from the live conversation is unchanged. It solves a different problem than continuity does.
