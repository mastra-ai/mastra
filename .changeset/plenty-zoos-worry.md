---
'@mastra/playground-ui': minor
---

Improved code rendering in the design system so `CodeBlock` is the canonical surface for static code.

**Fixed** syntax-highlighted code to follow light and dark mode by default. Token colors are now resolved in CSS from the active theme class instead of JavaScript, so highlighted code works without a `ThemeProvider`.

**Added** a low-level `Code` component, now shared by `CodeBlock` and `MarkdownRenderer` and exported for custom code surfaces:

```tsx
import { Code } from '@mastra/playground-ui';

<Code code="pnpm dlx mastra init" lang="bash" />;
```

**Added** an `overflow` prop to `CodeBlock`. Use the default `wrap` for commands and snippets, and `scroll` for source code where preserving columns matters:

```tsx
<CodeBlock code={source} lang="typescript" overflow="scroll" />
```

**Added** Python syntax highlighting support.
