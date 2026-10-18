---
'@mastra/factory': patch
---

Fixed deleted sessions leaving their provider sandbox behind when the server had restarted or a different replica handled the delete. Deleting a session that has started a sandbox before now destroys that sandbox through the configured provider, so E2B sandboxes are no longer left paused forever. Sessions that never started a sandbox do not create one.
