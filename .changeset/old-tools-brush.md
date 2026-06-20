---
'@mastra/slack-signals': minor
'mastracode': patch
---

Added a Slack Signals provider that lets agents watch selected Slack channels and DMs and receive new messages as notification signals.

MastraCode now includes Slack Signals setup and `/slack` commands for token management, listing channels, subscribing or unsubscribing a thread from specific channels, and viewing Slack signal diagnostics.

Added Slack context tools for reading nearby channel messages and thread replies from notifications. MastraCode renders those Slack tool results as readable chat-style cards with hydrated usernames and a current-user marker.
