---
'@mastra/factory': minor
---

Take ownership of a teammate's session. `POST /web/user-sessions/:sessionId/owner` moves an org-visible session to the caller when the expected owner still holds it, mirrors the new owner onto the live thread, and recycles the live session once its current run ends. The steering line under the composer gets a Take ownership button.
