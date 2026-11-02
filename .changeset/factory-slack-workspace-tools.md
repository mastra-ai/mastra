---
'@mastra/factory': minor
---

Added Slack tools so sessions linked to a Slack thread can work across the rest of the workspace: `slack_search` finds messages in specific channels, `slack_read` reads a thread from a permalink or a channel's recent messages, and `slack_send` posts to a channel, a reply in another thread, or a direct message to a teammate. They use the app's existing bot scopes, so you don't need to reinstall. Posting refuses Slack Connect channels, people outside the workspace, bots, and the session's own thread. Reading or posting in a private conversation other than the session's own needs the person the session works for to be a member of it. If that person is a guest or from another organization, every other conversation needs their membership and direct messages are refused.
