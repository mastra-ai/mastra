---
'@mastra/factory': patch
---

Fixed board item cards reporting a different session status than the sidebar. Cards read their own poll and only knew two states, so a card looked ready while its workspace was still cloning, ignored runs on any session but the most recently bound one, and claimed "ready — your turn" the moment it had a session at all. Cards and sidebar rows now resolve status from the one shared rule: working while any bound session runs, initializing while the workspace is still materializing, ready only when a session actually finished under your nose, and a distinct still marker when there is nothing to report.
