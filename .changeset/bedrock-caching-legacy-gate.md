---
'@mastra/code-sdk': patch
---

Bedrock prompt caching is now enabled by enumerating the closed set of legacy Claude 3.x models that support it and defaulting every newer Anthropic family on, instead of matching against an allow-list of current model IDs. The allow-list was permanently behind: newly released cache-capable models were silently billed at full input rate (roughly 10x the cached cost) until their IDs were manually appended. Claude 4+ and all named families (opus-5, sonnet-5, fable, mythos, and future families) now cache without a code change, while `claude-3-5-sonnet-20240620` and non-Anthropic models remain correctly excluded. Fixes #23552.
