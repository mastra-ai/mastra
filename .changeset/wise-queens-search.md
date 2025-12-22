---
'@mastra/core': patch
---

Fixed double validation bug that prevented Zod transforms from working correctly in tool schemas.

When tools with Zod `.transform()` or `.pipe()` in their `outputSchema` were executed through the Agent pipeline, validation was happening twice - once in Tool.execute() (correct) and again in CoreToolBuilder (incorrect). The second validation received already-transformed data but expected pre-transform data, causing validation errors.

This fix enables proper use of Zod transforms in both `inputSchema` (for normalizing/cleaning input data) and `outputSchema` (for transforming output data to be LLM-friendly).
