---
'@mastra/memory': patch
---

Fixed Observational Memory failing every turn with "Maximum call stack size exceeded" after an agent viewed a large image, such as a multi-megabyte screenshot. Observation now continues normally in threads that contain large images.

Token estimates for images and other media in tool results are now reused after messages are reloaded from storage, so each attachment is measured once instead of on every turn.
