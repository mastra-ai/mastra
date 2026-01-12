---
"@mastra/core": patch
---

Fix agent runs with multiple steps only showing last text chunk in observability tools

When an agent model executes multiple steps and generates multiple text chunks, the onFinish payload was only receiving the text from the last step instead of all accumulated text. This caused observability tools like Braintrust to only display the final text chunk. The fix now correctly concatenates all text chunks from all steps.
