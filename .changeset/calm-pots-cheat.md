---
'@mastra/playground-ui': patch
'mastracode': patch
---

Added output token count display to shell tool footers. Shows the tiktoken-based token estimate (e.g. "1.5k tokens") in the command footer when output exceeds 1k tokens, giving visibility into how much context each shell command consumes.
