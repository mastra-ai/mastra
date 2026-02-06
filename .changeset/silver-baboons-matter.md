---
'@mastra/core': patch
---

Fixed tool input validation failing when LLMs return stringified JSON for array or object parameters. Some models (e.g., GLM4.7) send `"[\"file.py\"]"` instead of `["file.py"]` for array fields, which caused Zod validation to reject the input. The validation pipeline now automatically detects and parses stringified JSON values when the schema expects an array or object. (GitHub #12757)
