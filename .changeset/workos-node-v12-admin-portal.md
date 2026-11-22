---
'@mastra/auth-workos': minor
---

Upgraded `@workos-inc/node` to v12. `getWorkOS()` now returns a v12 `WorkOS` client, so if you call the WorkOS SDK directly, follow the [WorkOS v12 migration notes](https://github.com/workos/workos-node/releases). For example, admin portal links are now generated with `workos.adminPortal.generateLink()` instead of `workos.portal.generateLink()`, and `GeneratePortalLinkIntent` is now `GenerateLinkIntent`. `WorkOSAdminPortal` has been updated to use the new API and its behavior is unchanged.
