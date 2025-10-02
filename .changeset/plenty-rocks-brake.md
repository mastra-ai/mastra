---
'@mastra/playground-ui': patch
'mastra': patch
'create-mastra': patch
'@mastra/core': patch
'@mastra/deployer': patch
---

Model router documentation and playground UI improvements

**Documentation generation (`@mastra/core`):**
- Fixed inverted dynamic model selection logic in provider examples
- Improved copy: replaced marketing language with action-oriented descriptions
- Added generated file comments with timestamps to all MDX outputs so maintainers know not to directly edit generated files

**Playground UI model picker (`@mastra/playground-ui`):**
- Fixed provider field clearing when typing in model input
- Added responsive layout (stacks on mobile, side-by-side on desktop)
- Improved general styling of provider/model pickers

**Environment variables (`@mastra/deployer`):**
- Properly handle array of env vars (e.g., NETLIFY_TOKEN, NETLIFY_SITE_ID)
- Added correct singular/plural handling for "environment variable(s)"
