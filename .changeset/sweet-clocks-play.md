---
'@mastra/server': minor
'@mastra/playground-ui': patch
'@mastra/client-js': patch
'@mastra/mongodb': patch
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/pg': patch
---

Added draft/published status support for CMS agents and scorers. Storage list methods no longer default to filtering only published entities, so draft agents and scorers now appear in the playground. Agent status is exposed in the API response and shown as a badge in the agents list.
