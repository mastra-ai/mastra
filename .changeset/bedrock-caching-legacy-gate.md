---
'@mastra/code-sdk': patch
---

Enable Bedrock prompt caching for all cache-capable Claude models.

Previously the caching gate matched an allow-list of current model IDs, so newly released cache-capable models were silently billed at the full input rate (~10x the cached cost) until their IDs were added by hand. The gate is now inverted:

- Claude 4+ and all named families (opus-5, sonnet-5, fable, mythos, and future families) cache automatically with no code change.
- The closed set of cache-capable Claude 3.x models (3.7 Sonnet, 3.5 Sonnet `20241022`, 3.5 Haiku) is enumerated explicitly.
- `claude-3-5-sonnet-20240620` and non-Anthropic models remain excluded.

Fixes #23552.
