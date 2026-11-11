---
'@mastra/factory': patch
---

Documented the exact value `source.repository` takes for each provider: `owner/repo` on GitHub (`mastra-ai/mastra`, not `mastra`), the full project path on GitLab, the team key on Linear and the project key on Jira, compared case-insensitively. incident.io items have none (test `source.provider equals incidentio`), and manual cards have no `source.*` facts (test `source.kind not_exists`).

In the Factory route editor, **Repository, team or project** is now a searchable list of the project's linked repositories and the keys of its Linear teams and Jira projects. When another condition limits the provider, only that provider's values are offered. You can still type any value, and **is any of** picks several. The editor warns when a route limited to GitHub or GitLab requires a repository name with no owner, which never matches.
