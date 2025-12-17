---
'@mastra/playground-ui': patch
---

Add prominent warning banner in observability UI when token limits are exceeded (finishReason: 'length').

When a model stops generating due to token limits, the span details now display:
- Clear warning with alert icon
- Detailed token usage breakdown (input + output = total)
- Explanation that the response was truncated

This helps developers quickly identify and debug token limit issues in the observation page.

Fixes #8828