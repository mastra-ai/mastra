---
'@mastra/factory': minor
---

Take ownership of a teammate's session. `POST /web/user-sessions/:sessionId/owner` moves an org-visible session to the caller when the expected owner still holds it, refuses while the session has a run in flight, mirrors the new owner onto its thread, and recycles the live host so the next message starts under the new owner. The steering line under the composer gets a Take ownership button.
