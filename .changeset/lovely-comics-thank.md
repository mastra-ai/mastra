---
'@mastra/server': patch
---

Fixed skill removal for glob-discovered skills. The remove handler now looks up a skill's actual discovered path instead of assuming the hardcoded `.agents/skills` directory, so skills discovered via glob patterns can be correctly deleted.
