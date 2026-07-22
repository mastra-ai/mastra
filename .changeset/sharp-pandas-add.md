---
'@mastra/deployer': patch
---

Added secure Agent Learning reads to local Studio development. Requests stay same-origin, and browser-supplied credentials and tenant scope are ignored.

```sh
MASTRA_PLATFORM_ACCESS_TOKEN=<organization-api-key> \\
  MASTRA_PROJECT_ID=<project-id> \\
  mastra dev
```
