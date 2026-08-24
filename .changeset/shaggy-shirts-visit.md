---
'@mastra/factory': minor
---

Added board card detail endpoints for GitHub issues and pull requests: GET /web/github/projects/:id/issues/:number and /prs/:number return one item's metadata with its markdown description, so Studio board dialogs can show the source description without bloating the list feeds.
