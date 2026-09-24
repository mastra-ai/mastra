---
'@mastra/playground-ui': minor
---

**Status dots use one circular shape.** `StatusDot` and `Status` now draw every state as a circle. Meaning comes from color plus a filled or ring treatment. The `square` and `dashed` glyphs and the blue `idle` tone are removed.

**Canonical deploy states.** `deployStates` exports the six deploy and server states: Ready, Building, Idle, Queued, Stopped, and Error. Idle and Queued are gray rings, Stopped is a gray filled dot.

```tsx
// Before
{ label: 'Stopped', tone: 'neutral', glyph: 'square', description }
{ label: 'Idle', tone: 'idle', description }

// After
{ ...deployStates.stopped, description }
{ ...deployStates.idle, description } // { tone: 'neutral', glyph: 'ring' }
```

**Status labels inherit text style.** The label now always takes the size and color of its container, so it matches the other cells in a `DataList` without a wrapper. The `children` slot is removed; style the container instead.

```tsx
// Before
<Status presentation={presentation}>
  <Txt as="span" variant="body-sm">{presentation.label}</Txt>
</Status>

// After
<Status presentation={presentation} />
```
