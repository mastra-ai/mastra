---
'@mastra/core': patch
---

Fixed issue where some models incorrectly call skill names directly as tools instead of using skill-activate. Added clearer system instructions that explicitly state skills are NOT tools and must be activated via skill-activate with the skill name as the "name" parameter. Fixes #12654.
