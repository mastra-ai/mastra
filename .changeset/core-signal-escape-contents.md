---
'@mastra/core': minor
---

Added `escapeContents` to signals so trusted, server-built contents can reach the model as written. Signal contents are XML-escaped by default, which turns shell commands like `pnpm build && pnpm test 2>&1` into `pnpm build &amp;&amp; pnpm test 2&gt;&amp;1`. Set `escapeContents: false` to skip that:

```ts
agent.sendSignal(
  {
    type: 'reactive',
    tagName: 'skill',
    attributes: { name: 'release' },
    contents: 'Run `pnpm build && pnpm test 2>&1`.',
    escapeContents: false,
  },
  { resourceId: 'user-123', threadId: 'thread-abc' },
);
// The model sees: <skill name="release">Run `pnpm build && pnpm test 2>&1`.</skill>
```

A closing tag matching the signal's own tag (here `</skill>`) and attribute values are still escaped. The setting is stored with the signal, so later turns render it the same way. Signals sent through the HTTP API or `@mastra/client-js` can't set it and are always escaped.
