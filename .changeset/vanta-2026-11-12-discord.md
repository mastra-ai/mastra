---
'@mastra/discord': patch
---

**Security**

The CommonJS build now bundles undici 8.12.4 (it was 8.12.2). This fixes the November 2026 undici advisories (GHSA-mqg3-3v4r-cm32 and others). With the old version, cached responses could be poisoned or leak between users across redirects, credentials could reach cross-origin redirect targets, Subresource Integrity checks could be bypassed, and cache replay errors could crash the process.
