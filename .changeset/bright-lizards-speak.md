---
'@mastra/core': patch
---

Fixed the `tail` parameter of the workspace `execute_command` and `get_process_output` tools rejecting numeric strings. Models sometimes send number parameters as strings, for example `"10"` instead of `10`. The `timeout` parameter already tolerated this, but `tail` failed validation and the command never ran, wasting a turn. In observed cases the model then fabricated a success result instead of retrying. Numeric strings are now coerced to numbers for `tail` in both tools.
