---
'@mastra/memory': patch
---

Fixed observer agent truncation that could cut UTF-16 surrogate pairs in half when formatting messages, tool results, or observation lines with emoji or other astral-plane characters. This produced lone surrogates that strict JSON parsers (including Anthropic's) reject with errors like `no low surrogate in string`, causing observer runs to fail.
