---
'@mastra/code-sdk': patch
---

Fixed Windows file references in custom slash commands, including `@src\context.md`,
`@C:\path\to\file`, and `@C:/path/to/file`. Spaces, quoted paths, and glob patterns
are not supported.
