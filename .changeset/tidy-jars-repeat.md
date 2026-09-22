---
'@mastra/playground-ui': minor
---

Removed the `--neutral1` … `--neutral6` colour ramp and the `--text1` alias. Greys now come from the semantic roles the design system already exposes, so a colour says what it is for instead of how dark it is: `foreground` for body ink, `muted-foreground` for secondary, `placeholder` for the faintest, the `fill` ladder for tinted surfaces, and `border-focus` / `border-hover` for edges.

**Why** The ramp was a second grey scale sitting beside the ten-step `gray` one, and the two only lined up at the ink end — every other rung landed between gray steps, differently in light and dark. Picking `neutral4` meant picking a lightness, which is a decision the theme should make, not the call site.

**Before**

```tsx
<span className="text-neutral6">Title</span>
<span className="text-neutral3">Secondary</span>
<span className="text-neutral1">Hint</span>
<div className="bg-neutral6/5 border-neutral3/40" />
<Spinner color={Colors.neutral3} />
```

**After**

```tsx
<span className="text-foreground">Title</span>
<span className="text-muted-foreground">Secondary</span>
<span className="text-placeholder">Hint</span>
<div className="bg-fill border-muted-foreground/40" />
<Spinner color={Colors['muted-foreground']} />
```

`Colors.neutral1` … `Colors.neutral6` and `Colors.text1` are gone from the exported token map. `text-text1` becomes `text-foreground` — it was already an alias of it, so nothing moves on screen.
