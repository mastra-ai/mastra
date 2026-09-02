---
'@mastra/core': patch
---

Removed the vulnerable @ai-sdk/provider-utils@3.x dependency (CVE-2026-8769 / GHSA-866g-f22w-33x8) from @mastra/core. The helpers it supplied are now sourced from the patched provider-utils 4.x line already installed, so security audits no longer flag @mastra/core and its dependents. AI SDK v5 model compatibility is unchanged. Fixes #22592.
