---
'@mastra/core': patch
---

Fixed a bug where a server-side tool that was still running when a request was aborted (for example, when a turn parked waiting on a client-side tool and the response closed, or the user hit Stop) was persisted as a _completed_ tool call whose result was the abort message. On resume, the cancelled — and possibly half-finished — operation read as a successful tool call.

Tool executions interrupted by an aborted request are now left as incomplete calls instead of being recorded as fabricated successful results, so they are no longer mistaken for completed work when a conversation resumes. Genuine tool errors on a live request still surface to the model as before.
