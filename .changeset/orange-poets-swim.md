---
'mastra': patch
---

Improved user sessions so opening a new one creates only a local draft. The first prompt creates the session, becomes its display title, and is sent as soon as the thread opens, with the controller holding it until workspace preparation finishes. Deleting a session also removes its conversation when one exists.
