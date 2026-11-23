---
'@mastra/evals': patch
---

Fixed the content similarity scorer so that whitespace counts when `ignoreWhitespace` is `false`. Before, the option had no effect, and texts that differed only in whitespace always scored 1. The option is now `true` whenever it is not set, so only scorers that set it to `false` get different scores.
