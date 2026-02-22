---
'@mastra/playground-ui': patch
---

Improved the score dialog to show "N/A" with an explanation instead of "null" for code-based scorers that don't use prompts or generate reasons. The dialog now detects code-based scorers via the `hasJudge` metadata flag, with a heuristic fallback for older data.
