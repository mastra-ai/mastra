---
'@mastra/core': patch
---

Fixed a fractional `tail` value producing a truncation notice that disagreed with the returned output. The `execute_command` and `get_process_output` tools now reject a non-integer `tail`, and the `[showing last N of M lines]` notice always reports a whole number equal to the lines actually returned.
