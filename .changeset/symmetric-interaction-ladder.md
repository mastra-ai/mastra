---
'@mastra/playground-ui': minor
---

Made every surface and interaction state read at the same strength in light and in dark, and put every raised container on the one elevation recipe.

**Why**

Dark mode carried its own hand-written alphas, at roughly twice the light ones, on the premise that "a lightness step has to be large to register on a near-black surface". That premise is wrong: alpha compositing is linear in sRGB, so one alpha is one step in either direction — white over near-black spans 242 levels, near-black over near-white 233. The two ladders therefore drifted apart in ways that were visible everywhere:

- the `DataList` panel sat 0.105 in OKLab lightness above its canvas in dark but only 0.015 in light, so the same list read as a glowing slab on one theme and a quiet recess on the other
- a row's press state was 2.4× its hover step in dark against 1.8× in light, so `active` swamped `hover`
- the sidebar sat at absolute black (`oklch(0 0 0)`), 16 lightness points below the canvas where light keeps 2, leaving no room beneath the hover fill — the hover was effectively invisible
- the raised rim was black at 40% in dark, which paints a hard outline around a surface that is *lighter* than its canvas, while its light-side rim sat at 3% — under the ~5% where an inner edge stops being visible at all. A divider drawn inside a card was louder than the card's own boundary.

**What changed**

The fill and boundary ladders are now declared once and resolve from a single `--fill-tint`, the only part that flips per theme. Each rung is one alpha — `fill-subtle` 4%, `fill` 6%, `fill-hover` 9%, `fill-active` 12%, `fill-strong` 18%, `border` 9% — and measures within one 8-bit level of its counterpart in the other theme. The dark canvas moves off absolute black to mirror the light canvas/sidebar relationship, and the dark rim becomes a light one at 8%, just under `--border`, so a surface boundary is never quieter than a divider inside it.

`DataList`, the settings container and the metrics cards now take the shared raised surface (`bg-card` plus `--shadow-raised`) instead of each pairing a fill with its own border, which is what made them read as unrelated materials. A menu item sizes to its content above the control height, so an item carrying a name over a description no longer overflows into its neighbour.

**Removed**

`DashboardCard` (use `Card`), the numeric `Spacings` mirror — spacing comes off one multiplier that tailwind-merge already understands, and enumerating it was what let `h-auto h-form-md` both survive a merge — and the dead `badge-default` size token. The 300px dropdown cap is now `--max-height-dropdown` alone rather than the same constant repeated across the `--height-`, `--width-`, `--container-` and `--max-height-` namespaces; the `Sizes` mirror picks up the missing `icon-smd` and the corrected `form-lg`.
