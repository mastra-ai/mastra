---
'mastra': patch
---

Fixed Studio run targets to select only the current agent with the updated per-agent version API. Run badges and continuations use the immutable root version returned by the server, without changing sub-agent defaults.

Kept Editor's panel layout separate from Chat so a collapsed thread list doesn't hide version controls when opening Editor.
