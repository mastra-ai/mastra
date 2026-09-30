---
'@mastra/playground-ui': minor
---

Improved warning and error colors so alerts, status dots, badges, buttons, charts, and usage values read as one family in light and dark mode.

- The `yellow` ramp is now `amber`. It warms as it darkens, so warnings read as gold instead of mustard or olive.
- Red uses one hue across every step, so error text, badges, charts, and destructive buttons match.
- Added `--warning-foreground` and `--destructive-foreground` for colored text and icons. `*-indicator` is the fill for dots, bars, chart marks, and borders. The warning fill is too light to read as text in light mode, so text needs its own token.
- Dark-mode red surfaces (alerts, red badges, error washes) use a clear red instead of a brownish maroon, with a softer border.
- Destructive and warning badges use the same text color as the values beside them.
- The disabled destructive button uses a softer fill with muted text, so it no longer looks like an enabled button in a darker red.

**Removed**

| Removed | Replacement |
| --- | --- |
| `--yellow-50` … `--yellow-950` and `*-yellow-*` utilities | `--amber-*`, `*-amber-*` |
| `--yellow-soft-*` and `*-yellow-soft-*` utilities | `--amber-soft-*`, `*-amber-soft-*` |
| `--badge-yellow-strong`, `-subtle`, `-edge`, `-indicator`, `-foreground` | `--badge-amber-*` |
| `--chart-yellow` | `--chart-amber` |
| Badge `variant="yellow"` | `variant="amber"` |
| `'yellow'` in `categoricalHues` and `CategoricalHue` | `'amber'` |
| `yellow-*`, `yellow-soft-*`, `badge-yellow-*`, and `chart-yellow` keys in `Colors` from `@mastra/playground-ui/tokens` | The matching `amber` keys |
| `text-warning-indicator` and `text-destructive-indicator` for text and icons (the tokens remain for fills) | `text-warning-foreground`, `text-destructive-foreground` |

`--color-brand-yellow` is part of the fixed Mastra palette and is unchanged.

```tsx
// Before
<Badge variant="yellow">Pinned</Badge>
<span className="text-warning-indicator">870K</span>
<i className="bg-badge-yellow-indicator" />

// After
<Badge variant="amber">Pinned</Badge>
<span className="text-warning-foreground">870K</span>
<i className="bg-badge-amber-indicator" />
```
