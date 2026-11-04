---
'@mastra/core': patch
---

Fixed the `execute_command` truncation notice so it says which lines were dropped. When long output is cut in the middle, the notice now names the dropped lines and the lines kept on each side, for example `[...output truncated — dropped lines 24-199; showing first ~200 tokens (lines 1-23) + last ~1800 tokens (lines 200-400) of ~3600 tokens...]`, so agents can read just the missing range instead of re-running the command. Line numbers count from the first line of output the tool received, even when `tail` trimmed it first. The same notice is used by `get_process_output` and `kill_process`. Fixes [#28411](https://github.com/mastra-ai/mastra/issues/28411).
