---
'mastra': patch
---

Improved how user sessions start in Mastra Code. Opening a new session no longer creates one on the server, so closing an empty composer leaves nothing behind. The first prompt creates the session, names it in the sidebar, and is sent straight away instead of waiting for the workspace to finish preparing. If creating the session fails, the prompt is kept so retrying reopens the same session rather than a duplicate. Deleting a session now also removes its conversation.
