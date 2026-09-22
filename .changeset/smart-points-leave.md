---
'@mastra/factory': patch
---

Fixed diff-comment tool calls failing on OpenAI models. Creating or replying to a line-anchored review comment with `source_control_create_diff_comment` no longer produces an invalid function schema that the model API rejects; both modes are validated from one object input.
