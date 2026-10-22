---
'@mastra/code-sdk': patch
---

The Claude Max provider now defaults to `claude-sonnet-5-5`. The previous default, `claude-sonnet-4-20250514`, was retired by Anthropic on 2026-06-15, so calls that relied on it failed.
