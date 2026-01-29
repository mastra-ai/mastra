---
'@mastra/core': patch
---

Fix tool call argument resolution when arguments are split across messages.

Previously, a later tool invocation with empty args could override an earlier

invocation containing the actual payload. This change ensures empty args are

skipped and the valid arguments are preserved.
