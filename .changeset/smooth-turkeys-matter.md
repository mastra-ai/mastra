---
'@mastra/gcs': patch
---

Fixed an issue where images and PDFs stored in Google Cloud Storage were not surfaced to the agent as viewable media parts. The GCS workspace filesystem now populates `mimeType` on `stat()` from the object's stored `Content-Type` (with extension-based fallback), so the workspace `read_file` tool can route them through its native media-part path the same way the local filesystem does.
