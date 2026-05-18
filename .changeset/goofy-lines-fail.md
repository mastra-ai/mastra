---
'@mastra/server': patch
'@mastra/core': patch
---

Fixed CompositeAuth incorrectly advertising SSO, session, and user provider capabilities when no inner provider supports them. Studio would show an SSO login button even when no provider had SSO configured, leading to 401 errors on login attempts. The duck-typing check now verifies that interface methods are actual functions rather than just present on the prototype chain.
