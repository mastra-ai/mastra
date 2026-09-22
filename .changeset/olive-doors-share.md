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

**`InputGroup` inside a group**

A field keys its type scale off its own `data-size` (`text-caption` / `text-body-sm` / `text-body`), which the group's stylesheet cannot reach — forcing only the box left a `sm` group reading at `md`. `ButtonsGroup` now publishes its rung on the new `ControlSizeContext` (exported from `ds/primitives/control-size`) and `InputGroup` takes it **over** its own `size`, the same rule as every other segment: inside a group, an explicit `size` on the field is inert. Outside one, `size` behaves exactly as before.

A field's addon glyph is still a flat `size-4` at every rung. That is `InputGroup`'s own behaviour, in or out of a group, and changing it moves every field in the app — left as a follow-up.

**Removed**

`ButtonsGroupText` no longer takes a `size` prop. A text segment only exists inside a group, and the group sets its height.

`ButtonsGroupSeparator` is gone. A group joins its segments with a seam — one shared border, halved between neighbours — so an extra rule between them drew a second line on top of that seam. It had no call site outside its own story. A group that genuinely needs to separate two clusters should render its own divider, or be two groups.

**One material for a neutral filled control**

A group put the mismatch in plain sight: with every segment finally the same height, four of them still had four different fills. A field is the raised card material (`bg-card` + `shadow-raised`, white in light), a `Button` `default` was the translucent 6% `--fill` rung with a 1px border, and `ButtonsGroupText` was `--surface-panel`, the opaque twin of that rung.

`Button`'s `default` variant now wears the same raised material as a field, and so does the text segment. In light a default button is white on the off-white canvas, like the input and the select trigger beside it; in dark the two were already within a few levels of each other, so little moves. The material has no border of its own — its edge is the rim `shadow-raised` draws, and focus repaints that rim.

States follow the material rather than the fill: hover and press wash through `--surface-tint` (`fill-subtle`, then `fill`) instead of swapping the background, because a pinned card fill cannot be swapped without going translucent.

Removed with it: `fieldTriggerSurfaceStyle`, which existed only to undo the Button's fill on a Select/Combobox trigger, and the `field` key of `controlTriggerOpenState` — `default` now *is* the field's open state. `raisedControlSurfaceStyle` (exported from `ds/primitives/form-element`) is the one definition.

**Hover and focus inside a group**

A segment's leading edge belongs to its neighbour, so hovering an `outline` segment lit only three of its sides, and keyboard focus showed no edge at all — the group's seam colour overrode the segment's focus border. The focused segment now takes the focus colour on every side, and the neighbour that owns the shared seam takes the hover or focus colour with it.
