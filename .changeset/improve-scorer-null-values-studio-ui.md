---
'@mastra/playground-ui': patch
---

Improved the score dialog to show "N/A" with an explanation instead of "null" for empty scorer fields. Code-based scorers show "N/A — code-based scorer does not use prompts" and LLM scorers with unconfigured steps show "N/A — step not configured". Detection uses the `hasJudge` metadata flag with a heuristic fallback for older data.
