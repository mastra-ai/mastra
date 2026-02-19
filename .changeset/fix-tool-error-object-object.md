---
'@mastra/react': patch
---

fix(react): display tool error messages instead of [object Object] during streaming

Tool error results were rendered as "[object Object]" in the chat UI during streaming because `String()` was used to coerce serialized error objects. Now properly extracts the `.message` property from Error instances and serialized error objects.
