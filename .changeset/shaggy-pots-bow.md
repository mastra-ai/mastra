---
'@mastra/playground-ui': minor
---

Fixed the primary and destructive buttons going see-through on hover, press and disable — the card text or list row behind them no longer reads through the button.

Both variants fill themselves with a colour, but answered every state by dropping that fill's alpha, so the control opened a window onto its background exactly when the pointer arrived. Their states now resolve to opaque rungs instead, at the same colour the alpha used to render.

The new rungs are public: `--fill-inverse`, `--fill-destructive` and their `-hover` / `-active` / `-disabled` steps, shipped as `bg-fill-inverse*` and `bg-fill-destructive*`. Reach for them when a control carries its own colour:

```tsx
<div className="bg-fill-inverse hover:bg-fill-inverse-hover active:bg-fill-inverse-active text-background" />
```

The existing `--fill-*` ladder is unchanged and still translucent on purpose: those rungs are state layers for controls with no fill of their own (`ghost`, `outline`, list rows), where seeing the surface through them is the point.
