---
"@mastra/core": patch
---

fix(core): strip tools array when toolChoice is 'none' to prevent Gemini structured output errors

When toolChoice === 'none', prepareToolsAndToolChoice() now returns tools: undefined instead of serializing the full tools array. This prevents providers like Gemini from rejecting requests that combine tools + structured output (response_format: json_schema).
