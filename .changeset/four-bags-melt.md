---
'@mastra/core': patch
---

Fixed raw tool inputs being copied into logs and errors. When a tool call's JSON cannot be parsed, only the tool name and input length are logged instead of the full input. The `TOOL_EXECUTION_FAILED` error no longer includes an `argsJson` copy of the arguments, and raw arguments are no longer attached to exception-tracking metadata. Raw arguments are also no longer included in the debug log written at the start of each tool call. Tool inputs remain available on the tool's trace span, where observability redaction applies. The truncated `Provided arguments:` excerpt in schema validation errors is intentionally unchanged, because the model uses it to correct the call. Fixes https://github.com/mastra-ai/mastra/issues/22926
