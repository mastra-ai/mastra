---
"@mastra/evals": patch
---

Fix answer-similarity scorer to align prompt guidelines with allowed match types

The answer-similarity scorer could throw a ZodError when the LLM returned
"contradiction" as a matchType, since only exact/semantic/partial/missing are
valid. The prompt now correctly directs contradictory information to the
existing contradictions array instead.
