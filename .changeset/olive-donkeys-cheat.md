---
'@mastra/core': patch
---

Fixed the workspace command tools reporting a line count they did not return. When a model passed a fractional `tail` (for example `2.5`), `execute_command` and `get_process_output` returned a truncation notice reading "showing last 2.5 of 10 lines" while actually returning 2 lines, so the model was told the output was cut at a boundary that does not exist. The notice now always reports the whole number of lines returned, and `tail` is validated as an integer so a fractional value is rejected instead of silently reshaping the output.
