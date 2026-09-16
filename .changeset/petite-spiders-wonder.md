---
'@mastra/factory': patch
---

Fixed Factory skill dispatch sending a second kickoff into a binding whose previous run is still in flight. A new skill decision for a binding now waits for that binding's live run to end before delivering. A stale open-run record left behind by a crashed run no longer blocks the binding. Delivery outcomes that could not be confirmed now fail with the stable codes `skill_delivery_ambiguous` and `run_terminal_event_missing` instead of `unknown`.
