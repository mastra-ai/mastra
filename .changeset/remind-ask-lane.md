---
'@mastra/memory': minor
---

Let the main agent ask the Subconscious reminder agent questions in natural language.

A new `ask_memory` tool takes a question and a `wait` flag. With `wait: true` it blocks and returns the reminder agent's answer as the tool result. With `wait: false` it returns a correlation id immediately and the answer arrives later as the same `remembered` signal the passive reminder path already sends, carrying that id so a late answer names the question it belongs to.

Both dispositions run on the thread the reminder agent already keeps for the session, so a question and its answer become part of the one conversation the passive path also sees. That is what makes a follow-up like "when did that happen" resolvable: it is answered from the conversation, not from keyword retrieval.

The tool registers behind the existing Subconscious `tools` flag, alongside the knowledge tools. It resolves its model from the subconscious agent config or the observational memory model; the main agent's model is only reachable from the observation hook, so a deployment that relies on it gets an explicit unavailable result rather than a silent empty answer. Failures never throw into the main agent's turn.
