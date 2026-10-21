---
'@mastra/playground-ui': patch
---

Code editors and read-only code blocks now share one syntax highlighting theme, so colors match across Studio in light and dark mode. Dark-mode editors no longer use the Dracula palette, and the Shiki and Dracula dependencies are gone. Streaming code blocks re-parse only the newly appended text instead of the whole block on every update.

`tokenStyle` was removed. Highlighted tokens now carry a `className` with a `syntax-*` role class instead of inline color styles:

```tsx
// Before
<span className="shiki-token" style={tokenStyle(token)}>{token.content}</span>

// After
<span className={token.className}>{token.content}</span>
```

`highlight(code, lang)` now resolves to `{ code, tokens, tree }` instead of the token lines. Pass that result back as a third argument to reuse its parse when the new code only appends to it:

```ts
// Before
const lines = await highlight(code, 'ts');

// After
const result = await highlight(code, 'ts');
const lines = result?.tokens;
const next = await highlight(code + more, 'ts', result ?? undefined);
```
