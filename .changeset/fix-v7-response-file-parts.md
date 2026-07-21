---
'@mastra/core': patch
---

Fixed generated files from AI SDK v7 models (e.g. gpt-image-1 image output) being corrupted in stream output and saved message history. The tagged V4 file data is now converted to the flat shape Mastra's stream pipeline and message storage expect. This covers both `file` and `reasoning-file` response parts.

Also fixed handling of URL-backed generated files: the URL is no longer mislabeled as base64 in file chunks, UI message streams now emit the URL directly instead of a broken data URI, and reading `.uint8Array` on a URL-backed generated file now throws a descriptive error instead of returning garbage.
