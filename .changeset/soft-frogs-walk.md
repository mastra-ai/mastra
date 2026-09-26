---
'@mastra/memory': patch
---

Fixed the observational memory `recall` tool dropping attachment references. Image and file parts now include their media type and the stored URL or provider file ID instead of only the filename, so agents can reuse an earlier attachment. The `recall` tool also accepts `viewAttachment` alongside `cursor` and `partIndex` to show the attachment itself: inline data is sent to the model as a native media part, and `http(s)` URLs are passed through for the provider to fetch. Media types outside `image/*` and `application/pdf`, provider file IDs, and oversized payloads come back as an explanation instead. Fixes #23813.
