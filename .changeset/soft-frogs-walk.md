---
'@mastra/memory': patch
---

Fixed the observational memory `recall` tool dropping attachment references. Image and file parts now include their media type and the stored URL or provider file ID instead of only the filename, so agents can reuse an earlier attachment. Inline file data such as base64 or data URIs is still left out of recall results. Fixes #23813.
