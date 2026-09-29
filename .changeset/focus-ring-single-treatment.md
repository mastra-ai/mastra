---
'@mastra/playground-ui': minor
---

Keyboard focus now looks the same everywhere: a 1px neutral ring with no green halo. `focusRing` is a single class string instead of an object, and the halo and `ring` alias tokens are removed. The Trace Intelligence empty state also drops its glowing and pulsing decorations.

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

| Removed                                     | Use instead                                    |
| ------------------------------------------- | ---------------------------------------------- |
| `focusRing.visible`, `.default`, `.simple`  | `focusRing`                                    |
| `FocusRingStyle` type                       | none                                           |
| `--ring`, `ring-ring`, `Colors.ring`        | `--border-focus`, `ring-border-focus`          |
| `--shadow-focus-ring`, `shadow-focus-ring`  | none                                           |
| `--focus-halo`, `Shadows['focus-ring']`     | none                                           |
