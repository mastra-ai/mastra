---
'@mastra/playground-ui': minor
---

Added shared headline, introduction, and uppercase section-label roles to Txt. Txt supports text elements only; native containers and controls retain their markup, default typography, and child composition.

Migrate text-only div usages to paragraphs:

```tsx
// Before
<Txt as="div" variant="body">Content</Txt>

// After
<Txt as="p" variant="body">Content</Txt>
```

Keep a native layout wrapper for controls or multiple blocks. Use Code for preformatted code and Txt at the text leaf. Shared components continue to own their typography through existing size and semantic variants, without generic text-role forwarding props.

CodeEditor accepts `font="body"` for prose editors and defaults to `font="mono"` for code. Command groups retain compact uppercase headings.
