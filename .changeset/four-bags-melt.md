---
'@mastra/core': patch
---

Fixed raw tool inputs being copied into logs and errors. When a tool call's JSON cannot be parsed, only the tool name and input length are logged instead of the full input. The `TOOL_EXECUTION_FAILED` error no longer includes an `argsJson` copy of the arguments, and raw arguments are no longer attached to exception-tracking metadata. Tool inputs remain available on the tool's trace span, where observability redaction applies. Fixes https://github.com/mastra-ai/mastra/issues/22926
