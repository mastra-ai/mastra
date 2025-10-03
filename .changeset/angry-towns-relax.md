---
'@mastra/deployer': patch
---

fix: custom API routes now properly respect authentication requirements

Fixed a critical bug where custom routes were bypassing authentication when they should have been protected by default. The issue was in the `isProtectedPath` function which only checked pattern-based protection but ignored custom route configurations.

- Custom routes are now protected by default or when specified with `requiresAuth: true`
- Custom routes properly inherit protection from parent patterns (like `/api/*`)
- Routes with explicit `requiresAuth: false` continue to work as public endpoints
- Enhanced `isProtectedPath` to consider both pattern matching and custom route auth config

This fixes issue #8421 where custom routes were not being properly protected by the authentication system.
