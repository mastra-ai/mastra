---
'@mastra/core': patch
---

Signal contents now reach the model as written inside their tag. Previously `&`, `<` and `>` were turned into `&amp;`, `&lt;` and `&gt;`, so commands and code in reminders, notifications and other signals arrived mangled.

```ts
await agent.sendSignal(
  { type: 'reactive', tagName: 'skill', attributes: { name: 'release' }, contents: 'Run `pnpm build && pnpm test 2>&1`.' },
  { resourceId, threadId },
);
// Before: <skill name="release">Run `pnpm build &amp;&amp; pnpm test 2&gt;&amp;1`.</skill>
// After:  <skill name="release">Run `pnpm build && pnpm test 2>&1`.</skill>
```

A closing tag for the signal's own tag inside its contents, such as `</skill>`, is still escaped so contents can't end the tag early. Attribute values are still escaped.
