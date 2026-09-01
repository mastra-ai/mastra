---
'@mastra/playground-ui': minor
---

Added a `shadow-panel` token and a `--chart-soft-1` through `--chart-soft-5` sequential color ramp to the design system.

**shadow-panel** — the resting elevation for a panel that sits on the page rather than floating over it. It reads one step below `shadow-dialog`, so a page tiled with panels still looks like a single plane.

```tsx
<div className="border-border1 bg-surface3 shadow-panel rounded-xl border">…</div>
```

**--chart-soft-1..5** — one hue, lightness carrying the reading, for a single measure shown at five depths. Use it where `--chart-1..5` does not fit: that palette is categorical (five series, no order between them), this one is ordered. It flips with the theme, darkening on white and brightening on near-black.

```tsx
<Bar fill="var(--chart-soft-1)" />
```
