---
'@mastra/client-js': patch
'@internal/playground': patch
---

Port the `yj/magnificent-marquess` frontend stack onto `rain-purpose`.

- `@mastra/client-js`: new `ToolProvider` resource and a `getModelPolicy` accessor on the root client. Route types regenerated for the new endpoints.
- `@internal/playground`: Agent Builder routes (agents, skills, infrastructure, favorite, library) wired into the router, `RoutePermissionGuard` and `RoleImpersonationProvider` applied to the app shell, new login layout, role-impersonation banner, `useRestoreFocus` hook, `StudioIndexRedirect` home, and supporting tweaks across agents, browser view, LLM, and CMS surfaces.

Existing client-tools-on-signals work and the unrouted Agent Builder view/edit pages are preserved.
