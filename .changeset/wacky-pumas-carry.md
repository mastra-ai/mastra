---
'@mastra/playground-ui': minor
---

Added an `info` prop to `FieldLabel`. It shows a small info icon after the label with your text in a tooltip on hover or keyboard focus. Clicking the icon never focuses the field.

```tsx
<FieldLabel info="Shown to people who pick this agent.">Display name</FieldLabel>
```

Removed `RequestContextLabel`, imported from `@mastra/playground-ui/domains/request-context/components/request-context-label`. Use `FieldLabel` from `@mastra/playground-ui/components/Field` with `info` instead.
