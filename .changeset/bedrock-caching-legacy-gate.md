---
'@mastra/code-sdk': patch
---

Fix Bedrock prompt caching to enable by default for all cache-capable Claude models.

The gate now enumerates the closed set of legacy Claude 3.x models that support caching and defaults every newer Anthropic family on, instead of matching an allow-list of current model IDs. The old allow-list was permanently behind — newly released cache-capable models were silently billed at full input rate (~10x the cached cost) until their IDs were manually appended.

- Claude 4+ and all named families (opus-5, sonnet-5, fable, mythos, and future families) now cache without a code change.
- `claude-3-5-sonnet-20240620` and non-Anthropic models remain correctly excluded.

Fixes #23552.
