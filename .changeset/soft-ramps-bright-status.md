---
'@mastra/playground-ui': minor
---

Added the full soft ramp and a bright status role.

- Every hue now has `--{hue}-soft-50` to `--{hue}-soft-950`, matching the strong ramp. The existing `300`, `600`, `900` and `950` steps are unchanged. Utilities such as `bg-green-soft-100` are generated.
- `{status}-bright` is lighter than `{status}-indicator`, for small live marks such as progress dots and activity belts. It exists for `destructive`, `warning`, `success` and `info`, and is step 300 in dark mode and 500 in light mode.
- `--chart-sequential-pale` is a pale purple that stays the same in both themes, for a secondary flow beside the sequential scale.

```tsx
<span className="size-2 rounded-full bg-warning-bright" />
```

Foundations/Color in Storybook now shows which roles resolve to each ramp step.
