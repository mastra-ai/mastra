---
'@mastra/playground-ui': major
---

Removed layout and control elements from Txt's supported tags. Txt now accepts only text elements, so typography stays on the text and native containers and controls own their layout and behavior.

Migrate text-only div usages to paragraphs:

```tsx
// Before
<Txt as="div" variant="body">Content</Txt>

// After
<Txt as="p" variant="body">Content</Txt>
```

Keep a native layout wrapper when the content contains controls or multiple blocks, and use inline `Txt as="span"` for labels. Buttons and links own their native/shared markup and wrap their label in Txt; Txt does not expose a `render` prop.

Added shared headline, introduction, and section-label text roles. Txt and text-bearing controls accept font and role props so applications can format identifiers and commands without overriding typography classes.

Replace `<Txt variant="caption" className="font-mono">run_123</Txt>` with `<Txt variant="caption" font="mono">run_123</Txt>`. Command fields can use `<Input font="mono" textVariant="caption" />`, and prose editors can use `<CodeEditor font="body" />`.

Text-only notices use a single text element with its own tone. Decorative dots and separators keep native elements, and technical previews use Code.

Command groups keep compact uppercase headings with the meta role by default. Use `headingVariant="eyebrow"` for a larger section label or `headingVariant="caption"` for sentence-case text.
