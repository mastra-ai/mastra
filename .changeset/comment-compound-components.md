---
'@mastra/playground-ui': patch
---

Added a `Comment` family of compound components for text-only comment threads: `Comment`, `CommentList`, `CommentItem` (with header, author, timestamp, body and actions slots) and `CommentComposer` (input + send button). The root `variant` prop switches between `default`, a flat thread with hover-revealed per-item actions, and `embed`, the same thread on a bordered card surface with a compact composer and no per-item actions.
