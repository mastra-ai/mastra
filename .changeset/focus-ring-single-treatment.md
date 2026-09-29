---
'@mastra/playground-ui': minor
---

Keyboard focus now looks the same everywhere: a 1px neutral outline with no green halo. Any focusable element that does not style its own focus gets it by default. `focusRing` is a single class string instead of an object, with `focusRingInset` for clipped full-width rows and `focusRingOffset` for checkboxes, radios, and switches. Interactive cards and other raised surfaces show focus by brightening their own rim (`surfaceRimFocus`), so they keep their elevation. The halo and `ring` alias tokens are removed. The Trace Intelligence empty state also drops its glowing and pulsing decorations.

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
