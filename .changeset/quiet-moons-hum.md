---
'@mastra/core': minor
---

Added an opt-in `defaultMount` option to `CompositeFilesystem`. Setting it to a configured mount path resolves relative paths that don't name a mount inside that mount, so with `defaultMount: '/data'`, `readFile('note.txt')` reads from `/data` instead of failing with `No mount for path`. Mount-prefixed and absolute paths keep their current meaning, and behavior is unchanged when the option is omitted. Fixes #25227.
