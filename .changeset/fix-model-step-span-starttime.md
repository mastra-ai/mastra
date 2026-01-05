---
"@mastra/core": patch
"@mastra/observability": patch
---

fix(observability): start MODEL_STEP span at beginning of LLM execution

The MODEL_STEP span was being created when the step-start chunk arrived (after the model API call completed), causing the span's startTime to be close to its endTime instead of accurately reflecting when the step began.

This fix ensures MODEL_STEP spans capture the full duration of each LLM execution step, including the API call latency, by starting the span at the beginning of the step execution rather than when the response starts streaming.

Fixes #11271
