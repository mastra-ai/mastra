---
'@mastra/playground-ui': patch
---

Fixed `formatModelName` for Bedrock model ids. Ids such as `us.anthropic.claude-sonnet-4-5-20250929-v1:0` now read as "Claude Sonnet 4.5" instead of "Us.anthropic.claude Sonnet 4.5 20250929 V1:0".
