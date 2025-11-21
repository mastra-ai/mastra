---
'@mastra/deployer': patch
---

Improved error reporting during module validation when bundling

The deployer now provides clearer, more actionable error messages when bundling fails. Instead of generic errors, you'll now see specific information about what went wrong and which module caused the issue.

- **Better error categorization**: Errors are now classified as `TypeError`, `ModuleNotFoundError`, or `ReferenceError`, making it easier to diagnose issues
- **Module-specific error messages**: When a module fails to load, the error now clearly states which module and file are involved
- **ESM compatibility improvements**: Added automatic injection of `__dirname` and `__filename` shims for CommonJS modules that reference these variables in an ESM context
- **Structured error reporting**: Errors are now serialized as JSON internally for more reliable parsing and better debugging

Previously, bundling errors could be cryptic and difficult to debug. For example, a missing dependency would show a generic error without clearly indicating which module needed to be added to your external dependencies. Now, the error messages guide you directly to the problem with suggestions on how to fix it.

This is particularly helpful when dealing with:

- Older CommonJS modules that need special handling
- Missing native dependencies that can't be bundled
- Module resolution failures in complex monorepo setups
