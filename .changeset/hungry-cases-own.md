---
'mastracode': minor
'@mastra/core': minor
---

Added streaming tool argument previews across all tool renderers. Tool names, file paths, and commands now appear immediately as the model generates them, rather than waiting for the complete tool call.

- **Generic tools** show live key/value argument previews as args stream in
- **Edit tool** renders a bordered diff preview as soon as `old_str` and `new_str` are available, even before the tool result arrives
- **Write tool** streams syntax-highlighted file content in a bordered box while args arrive
- **Find files** shows the glob pattern in the pending header
- **Task write** streams items directly into the pinned task list component in real-time

All tools use partial JSON parsing to progressively display argument information. This is enabled automatically for all Harness-based agents — no configuration required.
