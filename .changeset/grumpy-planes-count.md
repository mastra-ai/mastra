---
'@mastra/core': patch
---

Fixed a crash when tools with Zod v3 input schemas are used with backgroundTasks enabled. The framework injected its `_background` override field via Zod v4 `.extend()` into the user's Zod v3 schema, mixing v3 and v4 internals and causing `keyValidator._parse is not a function` at tool execution time. The injection now flows through the framework's standard JSON-Schema interop path, so it works uniformly across Zod v3, Zod v4, and JsonSchema-based tools.
