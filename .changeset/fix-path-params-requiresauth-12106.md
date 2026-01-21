---
"@mastra/server": patch
---

Fix path parameter routes not respecting requiresAuth setting

Fixes issue where custom API routes with path parameters (e.g., `/users/:id`) were incorrectly requiring authentication even when `requiresAuth` was set to `false`. The authentication middleware now uses pattern matching to correctly match dynamic routes against registered patterns.

Changes:
- Inlined path pattern matching utility (based on regexparam) to avoid dependency complexity
- Updated `isCustomRoutePublic()` to iterate through routes and match path patterns
- Enhanced `pathMatchesPattern()` to support path parameters (`:id`), optional parameters (`:id?`), and wildcards (`*`)
- Added comprehensive test coverage for path parameter matching scenarios

Fixes #12106
