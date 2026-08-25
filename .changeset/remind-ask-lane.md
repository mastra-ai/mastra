---
'@mastra/memory': minor
---

Let the main agent ask the Subconscious reminder agent questions in natural language.

A new `ask_memory` tool takes a question and a `wait` flag. With `wait: true` it blocks and returns the reminder agent's answer as the tool result. With `wait: false` it returns a correlation id immediately and the answer arrives later as the same `remembered` signal the passive reminder path already sends, carrying that id so a late answer names the question it belongs to.

Both dispositions run on the thread the reminder agent already keeps for the session, so a question and its answer become part of the one conversation the passive path also sees. That is what makes a follow-up like "when did that happen" resolvable: it is answered from the conversation, not from keyword retrieval.

Every entry to the reminder conversation — blocking asks, detached asks, and the passive reminder evaluation — now enters as a queued runtime message on the shared remind thread, so the thread runtime serializes them: one turn at a time, transcript persisted in causal order, no interleaving between a question and a passive evaluation that share the session.

The tool registers behind the existing Subconscious `tools` flag, alongside the knowledge tools. It resolves its model from the subconscious agent config or the observational memory model, including the `default` sentinel (which falls back to the observational memory default model). Configured failover arrays and dynamic model functions pass through to the reminder agent unreduced, and token-routed models resolve their tier from an estimate of the turn's assembled input (clamping to the largest tier rather than failing when the estimate exceeds every threshold). A deployment with no resolvable model at all gets an explicit unavailable result rather than a silent empty answer. Failures never throw into the main agent's turn, including a failing agent-registry lookup, which comes back as a tool error result.

Each lane turn has a deadline (120 seconds): if the turn does not complete in time, the waiting caller gets an error while the turn itself continues and its transcript still persists in order. A blocking ask also stops waiting when its calling turn aborts, without cancelling the lane turn.

Detached answers (`wait: false`) are best-effort and in-process only. Acceptance means the question was validated and the answer work started; there is no durable queue and no retry — only the same per-turn deadline. The signal's persist write is awaited when the sender exposes one, but if the process exits before the answer lands, the answer is lost. The tool's acceptance note says so to the calling agent.
