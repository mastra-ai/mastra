---
'@mastra/playground-ui': minor
---

Keyboard focus now looks the same everywhere: a 1px neutral outline with no green halo. Any focusable element that does not style its own focus gets it by default. `focusRing` is a single class string instead of an object, with `focusRingInset` for clipped full-width rows and `focusRingOffset` for checkboxes, radios, and switches. Fields, buttons, segmented buttons, and clickable cards show focus by repainting their own rim to the same colour, so they keep their elevation; their focus edge is stronger than before, at the `--border-focus` weight tuned for 3:1 contrast. The halo, `ring` alias, and lighter rim focus tokens are removed. The Trace Intelligence empty state also drops its glowing and pulsing decorations.

Before:

```tsx
<button className={cn('rounded-md', focusRing.visible)} />
<div className="focus-visible:ring-1 focus-visible:ring-ring focus-visible:shadow-focus-ring" />
```

After:

```tsx
<button className={cn('rounded-md', focusRing)} />
<div className={focusRingInset} />
```

| Removed                                    | Use instead                           |
| ------------------------------------------ | ------------------------------------- |
| `focusRing.visible`, `.default`, `.simple` | `focusRing`                           |
| `FocusRingStyle` type                      | none                                  |
| `--ring`, `ring-ring`, `Colors.ring`       | `--border-focus`, `ring-border-focus` |
| `--shadow-focus-ring`, `shadow-focus-ring` | none                                  |
| `--focus-halo`, `Shadows['focus-ring']`    | none                                  |
| `--surface-rim-focus`, `--field-rim-focus-on-surface` | `--border-focus`         |
