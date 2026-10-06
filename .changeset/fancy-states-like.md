---
'@mastra/playground-ui': minor
---

**Text roles**

Added shared headline, introduction, and uppercase section-label roles to Txt:

```tsx
<Txt as="h1" variant="hero">Welcome</Txt>
<Txt variant="lead">Introduction</Txt>
<Txt as="span" variant="eyebrow">Recent activity</Txt>
```

**Text elements and component ownership**

Txt supports text elements only; native containers and controls retain their markup, default typography, and child composition.

Migrate text-only div usages to paragraphs:

```tsx
// Before
<Txt as="div" variant="body">Content</Txt>

// After
<Txt as="p" variant="body">Content</Txt>
```

Keep a native layout wrapper for controls or multiple blocks. Use Code for preformatted code and Txt at the text leaf. Shared components continue to own their typography through existing size and semantic variants, without generic text-role forwarding props. Command groups retain compact uppercase headings.

**Editor fonts**

CodeEditor accepts `font="body"` for prose editors and defaults to `font="mono"` for code.
