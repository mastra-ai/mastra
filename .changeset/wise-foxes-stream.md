---
'mastra': patch
---

Fixed several issues with the studio playground's browser-stream connection:

- Studio no longer opens a browser-stream connection for agents that don't have any browser tools, so there are no more failed connection attempts or sidebar flicker on regular agent chats.
- Agents that do have browser tools now wait until a session actually exists before connecting, so opening a chat no longer triggers reconnect storms when no browser activity is happening yet.
- The screencast viewer no longer makes the rest of the chat UI re-render on every incoming frame, so scrolling, sidebars, and status indicators stay smooth while a browser session is live.
