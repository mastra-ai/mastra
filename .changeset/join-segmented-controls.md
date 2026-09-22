---
'@mastra/playground-ui': minor
---

`ButtonsGroup` is now always a joined segmented control, and `TabList` defaults to the pill treatment, so a row of related controls reads as one object instead of a set of neighbours.

**Why**

`ButtonsGroup` had a `spacing` prop: `close` joined the segments, `default` just put a gap between them. A row that does not join is not a group, so half the call sites were using a segmented-control component to get `flex gap-2`. The joined path also had a seam bug — two translucent 1px borders overlapped onto the same pixel, so the line between two segments read brighter than the ring around the whole group, and a `ghost` segment next to a selected one painted only half a capsule.

**What changed**

```tsx
// before — a group that does not group
<ButtonsGroup spacing="default">
  <Button>Compare</Button>
  <Button>Run</Button>
</ButtonsGroup>

// after — a plain row for independent actions
<div className="flex items-center gap-2">
  <Button>Compare</Button>
  <Button>Run</Button>
</div>

// after — a group for segments of one control
<ButtonsGroup aria-label="View">
  <Button variant={view === 'list' ? 'default' : 'ghost'}>List</Button>
  <Button variant={view === 'board' ? 'default' : 'ghost'}>Board</Button>
</ButtonsGroup>
```

The seam now follows shadcn's rule: the left segment owns it with its right border and the next segment drops its left edge, so exactly one border paints each seam and nothing overlaps. Every segment paints the ring, transparent variants included.

`TabList` used to fall back to a deprecated `line` variant when `variant` was omitted, which is what 43 of the app's tab lists were silently getting. `pill` is the default now and `line` is gone.

**Removed**

The `spacing` prop and the `ButtonsGroupSpacing` type; the `buttonsGroupVariants` export (the recipe is a stylesheet now); the `line` tab variant and `DeprecatedLineTabListVariant`; `new-theme.css` and the `new-theme` class, whose every declaration duplicated what `theme.css` already declares at the document root — importing `style.css` is all a consumer needs.
