---
'@mastra/connect': minor
---

Add a generated Jira provider with 37 tools covering issue lifecycle (create, update, transition, link), comments, worklogs, watchers, projects, users, and metadata lookups. The tool runtime now supports the template `updateMetadata` helper by caching derived connection facts (such as the Atlassian cloud ID) in memory for the lifetime of a toolset, so tools skip repeat discovery round-trips.
