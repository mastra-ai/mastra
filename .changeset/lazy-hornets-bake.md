---
'@mastra/factory': patch
---

Factory now tells open boards when something changes, so they no longer have to poll for it.

- Moving or editing a card, a decision being proposed, picked up, approved, retried, failed or finished, and a session starting, parking, finishing or being torn down mid-run each send a live update to every open board of the project. This includes sessions picked back up after a server restart.
- The live connection sends its first keepalive as soon as it opens, so a proxy that holds a response until its first byte no longer delays it.
