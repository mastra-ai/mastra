---
'@mastra/playground-ui': patch
'@mastra/deployer': patch
'mastra': patch
---

Add `MASTRA_ORGANIZATION_ID` and `MASTRA_PLATFORM_PROJECT_ID` support so the Signals studio page can scope entity-learning requests to an organization and project. When set, these are exposed as the `window.MASTRA_ORGANIZATION_ID` / `window.MASTRA_PLATFORM_PROJECT_ID` globals (injected through the same HTML/Vite/CLI/deployer plumbing as the observability endpoint), and every `/entity-learning/*` request sends them as `x-organization-id` / `x-project-id` headers. When either var is absent the corresponding header is omitted, preserving the previous behavior.
