---
'@mastra/deployer': patch
---

Added secure Agent Learning reads to local Studio development. Configure MASTRA_PLATFORM_ACCESS_TOKEN and MASTRA_PROJECT_ID, then open Studio through mastra dev; requests stay same-origin and browser-supplied credentials and tenant scope are ignored.
