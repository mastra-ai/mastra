---
'@mastra/playground-ui': minor
---

Added a `link` variant and an `iconEnd` prop to `Button`.

The `link` variant renders muted `label` text with no fill and no layout padding, so it lines up with the content around it, while an invisible hit area keeps it as easy to click as other buttons. An underline draws in on hover. `iconEnd` places an icon after the label on any variant, for example an arrow on a link that opens externally.

```tsx
<Button variant="link" render={<Link to="/usage" />}>
  View usage
</Button>

<Button variant="link" render={<a href={portalUrl} target="_blank" rel="noopener noreferrer" />} iconEnd={<ArrowUpRight />}>
  Open billing portal
</Button>
```
