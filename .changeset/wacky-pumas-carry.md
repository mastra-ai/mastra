---
'@mastra/playground-ui': minor
---

Added an `info` prop to `FieldLabel`. It shows a small info icon after the label with your text in a tooltip on hover or keyboard focus. Screen readers announce the text as the icon's description, and clicking the icon never focuses the field.

```tsx
<FieldLabel info="Shown to people who pick this agent.">Display name</FieldLabel>
```

Deprecated `RequestContextLabel` (`@mastra/playground-ui/domains/request-context/components/request-context-label`). It still works and now renders `FieldLabel` with `info`; use that directly instead.
