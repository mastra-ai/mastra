---
'@mastra/core': patch
---

Preserve `this` when resolving permissions for the "View as role" picker in `buildCapabilities`. Class-based RBAC providers (e.g. `@mastra/auth-workos`) read state from `this` inside `getPermissionsForRole`, but the method was being detached to a bare variable before invocation. This caused a `TypeError: Cannot read properties of undefined (reading 'options')` to be logged on every authenticated request and silently emptied the available roles list. The error was swallowed by a surrounding try/catch so admins saw an empty picker instead of a crash.
