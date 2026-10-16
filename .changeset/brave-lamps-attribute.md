---
'@mastra/factory': patch
---

Factory's Jira, GitLab, and incident.io platform integrations now send the configured project id (`MASTRA_PROJECT_ID`) as an `x-mastra-project-id` header on requests to the Mastra platform connection proxy, so intake activity is attributed to the right project. Direct (non-proxy) Jira and incident.io requests never send the header.
