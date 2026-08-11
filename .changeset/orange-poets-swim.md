---
'mastra': patch
---

Improved how user sessions start in Mastra Code. Opening a new session shows the chat immediately instead of a loader, and no longer creates anything on the server, so closing an empty composer leaves nothing behind. The first prompt creates the session, names it in the sidebar, and is sent straight away instead of waiting for the workspace to finish preparing. If creating the session fails, the prompt is kept so retrying reopens the same session rather than a duplicate. The composer shows the mode and model the session will start on — the Factory default model — and lets you pick others before sending, so the first run uses exactly what you chose. Deleting a session that is already gone from the server no longer reports an error.
