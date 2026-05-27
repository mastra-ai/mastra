---
'@mastra/core': patch
---

Fixed the "View as role" picker losing roles for class-based RBAC providers (e.g. `MastraRBACWorkos`). `buildCapabilities` now invokes `rbacProvider.getPermissionsForRole` on the instance so `this` is preserved, instead of destructuring the method and calling it standalone.
