---
'@mastra/core': patch
---

Fixed Anthropic 'tool_use ids were found without tool_result blocks immediately after' error. When client tools (e.g. execute_command) and provider tools (e.g. web_search) are called in parallel, the tool ordering in message history could cause Anthropic to reject subsequent requests, making the thread unrecoverable. Tool blocks are now correctly split to satisfy Anthropic's ordering requirements.
