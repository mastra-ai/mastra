---
'@mastra/memory': minor
---

Give the Subconscious reminder agent a send_reminder tool instead of a text contract

The reminder agent previously surfaced reminders as prose that code string-scanned: an exact `<no-reminder />` sentinel meant silence, and grounding was checked by substring-matching candidate ids against the reply text. That contract is gone. The agent now calls a `send_reminder` tool with structured arguments (the reminder text and the source ids it rests on). Grounding is validated against the candidate set the extractor actually retrieved from storage: hallucinated ids come back as a tool error the agent can correct within its remaining steps, at most one reminder is accepted per run, and not calling the tool at all is the no-reminder outcome. Text the agent writes outside the tool is never surfaced.

The emitted signal is unchanged: one reactive `remembered` signal per cycle carrying the reminder, its source ids, and the subconscious attribution. The ask lane (ask_memory, correlation ids, detached answers) is untouched.
