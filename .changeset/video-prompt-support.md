---
'@mastra/core': minor
---

Added video input support for prompts. Agents can now accept video content (mp4, webm, quicktime, mpeg, flv, 3gpp) as file parts in messages. Video media types are auto-detected from file bytes when no explicit `mediaType` is provided. Fixes #11743.
