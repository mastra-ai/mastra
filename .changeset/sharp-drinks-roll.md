---
'@mastra/core': patch
---

Fixed buildCapabilities() incorrectly gating SSO, credentials, session, and user features behind an EE license. These are OSS features that should work without a license in production. Only RBAC and ACL remain gated behind the EE license, matching the documented intent.
