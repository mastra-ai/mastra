---
'@mastra/core': patch
---

License validation for EE features (RBAC, ACL, FGA, SSO) now checks your license key against the Mastra license server instead of validating it locally.

**What changes for you**

- Set `MASTRA_LICENSE_KEY` to your license key. `MASTRA_EE_LICENSE` continues to work as a supported legacy alias, so existing deployments are unaffected.
- RBAC, ACL, and FGA are now enabled per-feature based on the entitlements your license plan includes, rather than a single blanket license check.
- If the license server is briefly unreachable, previously validated licenses keep working (72-hour grace period), and validation never blocks startup — it runs in the background.
- Development environments (`NODE_ENV` not set to production) are unaffected and keep full EE access without a license.
