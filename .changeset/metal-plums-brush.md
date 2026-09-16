---
'@mastra/factory': patch
---

Fixed the Factory keeping a review or work run executing after an external terminal transition revoked its binding. Terminal-stage cleanup now aborts the live run on each retired seat (leaving alone the seat that drove its own transition and any successor that took the session over), a resumed session whose binding was revoked on a settled item now surfaces a clear retirement error instead of silently dropping its transition tool, and a settled card no longer retries its close-out to the attempt limit as a false blocked state.
