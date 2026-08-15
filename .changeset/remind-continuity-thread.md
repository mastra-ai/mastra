---
'@mastra/memory': minor
---

Give the Subconscious reminder agent one conversation per session

The reminder agent was rebuilt from scratch on every observation run with no memory of any kind, so it could not know what it had already surfaced and could not resolve a follow-up against anything it said earlier. It now generates against a persistent thread keyed to the parent session, `subconscious:<threadId>:remind`, mirroring the convention the curator and learner already use.

That thread's Memory runs observational memory with the `experimental_subconscious` key omitted rather than with `observationalMemory: false`. Omitting the key is what keeps the reminder thread from spawning a nested subconscious against the reminder agent's own conversation, while still giving it compression and reflection. Turning observational memory on for this thread is a reasoned default, one judgement deep, not a measured one: it costs observation and reflection model calls per session, and short-lived clients may well want it off. Say so if the cost turns out ugly, because it is a config change and not a redesign.

The freshness guard that stops the reminder agent echoing knowledge just captured from the live conversation is unchanged. It solves a different problem than continuity does.
