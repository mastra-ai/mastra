---
'@mastra/core': patch
---

Fixed signals that arrive while a run is finishing. If the run ended before the signal was routed, the agent woke the thread without the session's request context, so a model resolved from that context failed with "No model available". The signal now starts its run through the session's idle path with full stream options. In Mastra Code's Factory, this failure repeated on every retry of a rule-driven run until the process restarted.
