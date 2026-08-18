---
'@mastra/factory': patch
---

Stop reporting a skill kickoff as successful when it was queued onto a run that was already ending.

Signals sent into an active session settle as `deliver`, which acknowledges routing but promises nothing about execution. If the in-flight run finished before draining its queue, the prompt was dropped: no turn started, no error surfaced, and the decision was marked succeeded while the work item sat in its new stage with nobody working on it. The dispatcher now confirms the signal actually landed in the thread and retries the decision when it did not, so the next attempt finds the session idle and takes the instrumented wake path.
