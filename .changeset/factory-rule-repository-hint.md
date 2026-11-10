---
'@mastra/factory': patch
---

Documented the exact value `source.repository` takes for each provider: `owner/repo` on GitHub (`mastra-ai/mastra`, not `mastra`), the full project path on GitLab, the team key on Linear and the project key on Jira, compared case-insensitively. The Factory rule editor shows `owner/repo, ENG, PLAT` as the value's placeholder, and warns when a condition limited to GitHub or GitLab tests a repository name with no owner, which never matches.
