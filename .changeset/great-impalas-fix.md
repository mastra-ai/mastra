---
'@mastra/editor': patch
---

Fixed a crash when importing `@mastra/editor/composio` in a fresh install. The package now requires `@composio/core` ^0.18.0, which matches what `@composio/mastra` uses. Previously the ranges could resolve to an incompatible pair (`@composio/core` 0.14.x with `@composio/mastra` 0.10.4), throwing `SyntaxError: The requested module '@composio/core' does not provide an export named 'omitNullToolArguments'` and breaking `mastra dev`.
