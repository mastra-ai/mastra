---
"@mastra/evals": patch
---

fix(evals): align answer-similarity prompt with Zod schema for matchType

The Matching Guidelines in prompts.ts listed "contradiction" as a matchType value,
but the Zod schema only allows exact/semantic/partial/missing. Replaced with an
instruction to use the existing contradictions array, matching the original design.
