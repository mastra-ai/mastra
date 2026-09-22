---
'@mastra/playground-ui': minor
---

Renamed the status inks `--warning1`, `--positive1`, `--negative1` to `--warning`, `--positive`, `--negative`. The digit promised a ramp that never existed — there is no `warning2` — and it was the last numbered name left after the neutral ramp and `--text1` were retired.

The utilities follow: `text-warning1` becomes `text-warning`, `bg-positive1/5` becomes `bg-positive/5`, and so on for `border-`, `ring-`, `stroke-` and `accent-`. `Colors.warning1` becomes `Colors.warning`.

**Before**

```tsx
<AlertTriangle className="text-warning1" />
<span className="border-positive1/40 bg-positive1/5" />
```

**After**

```tsx
<AlertTriangle className="text-warning" />
<span className="border-positive/40 bg-positive/5" />
```

These are still aliases onto the accent ramp and still carry the light-mode ceiling foundations documents: around 3:1 on white, which is an icon, dot or fill, not a sentence.
