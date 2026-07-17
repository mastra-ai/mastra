---
'@mastra/libsql': patch
---

Fixed an uncaught `RangeError: Maximum call stack size exceeded` when writing deeply-nested values (such as a long chained `Error.cause`) to LibSQL storage. `safeStringify` now caps its recursion depth and substitutes a `"[Max depth exceeded]"` sentinel instead of overflowing the stack.
