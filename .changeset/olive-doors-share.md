---
'@mastra/playground-ui': minor
---

Added a `size` prop to `ButtonsGroup`, and the group now owns the control rung of every segment it holds.

**Why**

A `ButtonsGroup` imposed no height of its own. Each segment brought its own off the control ladder (`sm` 28px, `md` 30px, `lg` 32px), so two segments on different rungs rendered a step in the joined pill — and nothing stopped that from happening. It was easy to hit by accident, because `CopyButton` defaults to `sm` while `Button`, `Input`, `SelectTrigger`, `Combobox` and `InputGroup` all default to `md`.

**What changed**

The rung is declared once, on the group, and a child's own `size` can no longer lift a segment off it. Height, the width of an icon-mode circle, and the glyph size all follow the group.

```tsx
// before — the rung repeated on every segment, and nothing checked they agreed
<ButtonsGroup>
  <CopyButton content={value} size="sm" />
  <Button size="sm" aria-label="Expand">
    <ExpandIcon />
  </Button>
</ButtonsGroup>

// after — one declaration, and a step in the pill is no longer expressible
<ButtonsGroup size="sm">
  <CopyButton content={value} />
  <Button aria-label="Expand">
    <ExpandIcon />
  </Button>
</ButtonsGroup>
```

`size` defaults to `md`. A group whose segments were all `sm` needs `size="sm"` on the group — without it those segments now render at `md`. `size="icon-sm" | "icon-md" | "icon-lg"` stays on a `Button`: on `Button` the `icon-*` sizes also select the square shape, and only their rung is overridden.

**Removed**

`ButtonsGroupText` no longer takes a `size` prop. A text segment only exists inside a group, and the group sets its height.

`ButtonsGroupSeparator` is gone. A group joins its segments with a seam — one shared border, halved between neighbours — so an extra rule between them drew a second line on top of that seam. It had no call site outside its own story. A group that genuinely needs to separate two clusters should render its own divider, or be two groups.
