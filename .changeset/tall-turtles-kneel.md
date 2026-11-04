---
'@mastra/core': patch
---

Fixed structured output on Claude models before 4.6, such as `claude-sonnet-4-5` and `claude-haiku-4-5`, failing when the conversation ends on an assistant message. Anthropic rejects that request with "pre-filling the `assistant` response is not supported", and the agent now recovers by retrying with a continue reminder instead of failing. Fixes [#28635](https://github.com/mastra-ai/mastra/issues/28635).
