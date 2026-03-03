---
'@mastra/memory': patch
---

Fixed observational memory compatibility with Codex and other stream-only providers. Observer and reflector calls now use the streaming API internally, so providers that require `stream: true` in requests work correctly out of the box.
