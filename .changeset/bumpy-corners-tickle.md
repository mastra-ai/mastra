---
'@mastra/core': patch
---

Fixed harness thread history dropping Anthropic thinking signatures so signed reasoning can round-trip on follow-up turns (#14559).

Also omit assistant messages that become empty after provider-history reasoning strips, avoiding Anthropic empty-content rejections.
