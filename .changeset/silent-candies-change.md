---
'@mastra/deployer': patch
---

Fixed dependency version resolution in monorepos.

**What's fixed:**

- Dependency versions are now accurately resolved in monorepos, even with hoisted dependencies
- ESM-only packages and transitive workspace dependencies are now correctly handled
- Deployer-provided packages (like `hono`) that aren't in your project are now resolved correctly

**Why this happened:**

Previously, dependency versions were resolved at bundle time without the correct project context, causing the bundler to fall back to `latest` instead of using the actual installed version.
