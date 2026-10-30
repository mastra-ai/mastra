---
'@mastra/factory': patch
'mastra': patch
---

The Knowledge page works again on the page store. It shows the project's Knowledge as a page tree beside either the graph or a full page view (markdown body, child pages, mentions, notes and activity), the same explorer Studio uses. Scope circles are captioned with their declaration's `displayLabel` (e.g. "Project") when one is set. The tree loads each level as it is opened, so every page is reachable, not just the graph's first 200. Edits agents make show up without a reload: the page follows a new change stream (`GET /web/factory/projects/:id/knowledge/events`) and refreshes as writes land, falling back to a refresh every few seconds when the stream is unavailable. Members see their organization's and the project's pages, never another project's or a session's. The deploying app's Knowledge must declare `project:$projectId` scopes (as Factory session runs already need); without them the page reports a configuration error instead of guessing what to show.
