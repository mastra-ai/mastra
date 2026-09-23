---
'@mastra/factory': minor
'@mastra/connect': patch
---

Added an Identity capability to integrations. On the Connections settings page, users can now claim which external accounts on each integration are theirs (GitHub, Linear, Jira, IncidentIO, Slack — standalone and platform variants). Claims are keyed per org+user, so joining a new organization starts a fresh claim set.

Once claimed, a global `@me` filter is available on the board filter chip and in the Cmd+K search palette. It resolves against every claimed external identity across every integration and matches records whose author, assignee, requester, or comment-author field matches any claimed id.

Candidate accounts are discovered from external comment authors already observed on your work items. If you know an external user id we haven't observed yet, you can type it into the panel and save — no need to wait for background ingestion.
