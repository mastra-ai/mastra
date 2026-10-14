---
'@mastra/memory': minor
---

Subconscious now takes its Knowledge org from the run's `org:` agent scope (legacy `organizationId` still accepted) and refuses a run with conflicting orgs, more than one org, or an org id containing `:`. A run with no org is legitimate: curate, remind and pins skip it quietly without writing, and the Knowledge tools return a tool error. A `project:` scope shares one Knowledge graph across a project's sessions, but only when Mastra set it for the run. The `knowledgeResourceId` request-context override is removed.
