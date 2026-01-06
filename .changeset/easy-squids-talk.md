---
'@mastra/core': patch
---

Fix base64 encoded images with threads - issue #10480

Fixed "Invalid URL" error when using base64 encoded images (without `data:` prefix) in agent calls with threads and resources. Raw base64 strings are now automatically converted to proper data URIs before being processed.

**Changes:**
- Updated `attachments-to-parts.ts` to detect and convert raw base64 strings to data URIs
- Fixed `MessageList` image processing to handle raw base64 in two locations:
  - Image part conversion in `aiV4CoreMessageToV1PromptMessage`
  - File part to experimental_attachments conversion in `mastraDBMessageToAIV4UIMessage`
- Added comprehensive tests for base64 images, data URIs, and HTTP URLs with threads

**Breaking Change:** None - this is a bug fix that maintains backward compatibility while adding support for raw base64 strings.
