---
"@mastra/core": patch
---

Fixed OpenAI Files API file IDs (e.g. `file-abc123`) being corrupted into invalid base64 data URIs, which caused `MastraError: Failed to download asset`. File IDs are now classified as provider file references and passed through untouched on every conversion path — v5 UI messages, v4 attachments, and v1 prompt messages — so `@ai-sdk/openai` can forward them as `{ file_id: "file-..." }` to the API.
