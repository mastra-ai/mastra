---
'@mastra/core': patch
---

Fixed workspace command tools discarding the start of long output.

`execute_command` and `get_process_output` cut output to the last 200 lines before applying the head-and-tail token budget, so the beginning was already gone by the time anything tried to keep it. A large JSON payload came back as its closing brackets, leaving an agent to re-run the command to find out what it had already fetched.

Both ends are now kept when no `tail` is requested — the first 200 and last 200 lines — and the head gets 30% of the token budget instead of 10%. Passing `tail` explicitly still returns the last N lines, and `tail: 0` is still unlimited.
