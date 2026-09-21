---
'@mastra/playground-ui': minor
---

Made every surface and interaction state read at the same strength in light and in dark, and put every raised container on the one elevation recipe.

**Why**

Dark mode carried its own hand-written alphas, at roughly twice the light ones, on the premise that "a lightness step has to be large to register on a near-black surface". That premise is wrong: alpha compositing is linear in sRGB, so one alpha is one step in either direction — white over near-black spans 242 levels, near-black over near-white 233. The two ladders therefore drifted apart in ways that were visible everywhere:

- the `DataList` panel sat 0.105 in OKLab lightness above its canvas in dark but only 0.015 in light, so the same list read as a glowing slab on one theme and a quiet recess on the other
- a row's press state was 2.4× its hover step in dark against 1.8× in light, so `active` swamped `hover`
- the sidebar sat at absolute black (`oklch(0 0 0)`), 16 lightness points below the canvas where light keeps 2, leaving no room beneath the hover fill — the hover was effectively invisible
- the raised rim was black at 40% in dark, which paints a hard outline around a surface that is _lighter_ than its canvas, while its light-side rim sat at 3% — under the ~5% where an inner edge stops being visible at all. A divider drawn inside a card was louder than the card's own boundary.

**What changed**

The fill and boundary ladders are now declared once and resolve from a single `--fill-tint`, the only part that flips per theme. Each rung is one alpha — `fill-subtle` 4%, `fill` 6%, `fill-hover` 9%, `fill-active` 12%, `fill-strong` 18%, `border` 9% — and measures within one 8-bit level of its counterpart in the other theme. Focus is the one rung that stays per-theme, because it answers to a 3:1 contrast floor rather than to symmetry: shade at dark's 40% measures 2.87:1 in light, so light holds 50%, and a test now composites the ring's alpha over each surface to enforce it. The dark canvas also moves off absolute black, mirroring the light canvas/sidebar relationship, so the alpha rungs have room beneath them.

`DataList`, the settings container and the metrics cards now take the shared raised surface (`bg-card` plus `--shadow-raised`) instead of each pairing a fill with its own border, which is what made them read as unrelated materials. The rim in that recipe is `--border` itself, so a surface boundary and a divider inside it are the same edge by construction in both themes. An interactive surface layers its state rung instead of swapping its background colour — swapping made a card composite over the canvas and therefore _darken_ on hover in dark — which also retires the last opaque hovers (`hover:bg-muted`, `hover:bg-card`) that sat off the ladder. A menu item sizes to its content above the control height, so an item carrying a name over a description no longer overflows into its neighbour.

Elevation splits in two, because the only thing a shadow has to say here is how far a surface sits from the canvas, and there are two distances. A *raised* surface is in the flow — card, panel, table head, the app frame — and lifts a couple of pixels; that restraint is also what keeps it honest, since a tile in a scrolling grid gets its shadow sliced into a hard line by the scroller when the falloff exceeds its own clearance. An *overlay* is detached — popover, dropdown, dialog, drawer, tooltip — is never clipped, and carries the long falloff. `shadow-raised` and `shadow-overlay` assemble those from `--elevation-lip`, `--elevation-raised` and `--elevation-overlay`, which also lets the rim resolve on the element instead of on `:root`.

The rim became its own token rather than a reuse of `--border`. A divider sits inside one surface and needs 9% to register; a rim sits between two surfaces that already differ by a lightness step, so it needs less, and reusing the divider value made every card look outlined. `--surface-rim` (5% dark / 8% light) now holds it, with `--surface-rim-hover` and `--surface-rim-focus` above it.

A field is the same material as a card: `bg-card` plus `shadow-raised`, no border of its own. That is what makes a filter input and the panel beside it read as one system — in light the field is white on the off-white canvas, in dark the same step above it. `Input`, `Textarea`, `Select`, `Combobox` and `InputGroup` all take it from one primitive, and their states repaint that single rim rather than stepping the fill, because an `<input>` cannot carry a pseudo-element and moving the fill would break the pinned card colour. Focus sits one step above hover — 14% dark / 18% light — not at the weight a bare outline needs: the edge here bounds a surface that already reads as raised, and the previous value drew a hard ring around every focused field.

Interaction on an opaque surface now layers instead of replacing. `hover:bg-fill-subtle` on top of `bg-muted` does not add a rung, it *substitutes* one — measured, that meant −3 levels in dark and +5 in light, so the same hover darkened one theme and lightened the other. The `state-layer` utility puts the rung on a pseudo-element beneath the content, which measures +9/−9 from any resting rung in both themes; the sidebar search control and the nav recipe were the loudest cases and are now on it.

Panels docked beside the app frame share the frame's material (`bg-background` plus the raised elevation) rather than the card's. The agent Config panel was a `Card`, one fill step lighter than the chat frame it sits next to, which made two peers read as different materials.

**Removed**

`DashboardCard` (use `Card`) and the numeric `Spacings` mirror — spacing comes off one multiplier that tailwind-merge already understands, so enumerating 37 rungs bought nothing, and the named rungs it does need are the `Sizes` scale. Registering that scale as `theme.spacing` also replaces seven per-utility class groups that duplicated it. Gone too: the dead `badge-default` size token. The 300px dropdown cap is now `--max-height-dropdown` alone rather than the same constant repeated across the `--height-`, `--width-`, `--container-` and `--max-height-` namespaces; the `Sizes` mirror picks up the missing `icon-smd` and the corrected `form-lg`, and a test now holds that mirror to `theme.css` so the next drift fails instead of going unnoticed.

The legacy `--surface1` … `--surface6` ramp and the `border1`/`border2` pair are gone. Six numbered surfaces described a palette, not a system: three canvas steps (`--background-1/2/3`, surfaced as `--sidebar`, `--background`, `--card`) plus the translucent fill rungs cover every real case, and the numbered names told a call site nothing about when to reach for one. `border1`/`border2` collapse into `border` and `border-strong` — one divider weight and one emphasis weight — which also retires the global `* { border-color }` default that quietly gave every bordered element a colour it never asked for.

**Consumers**

MastraCode's Factory SPA imports `theme.css` directly, so it consumed the deleted tokens and had to move with them. Its canvases map by role — `surface1` → `sidebar`, `surface2` → `background`, `surface3` → `card` — and `surface4/5/6` become fill rungs, which is what they were describing: they sat *above* the card in dark and *below* the page in light, an inversion an alpha rung expresses by construction and a fixed lightness step cannot. Its text moves off the retired `--text-ui-*` / `--text-header-*` scale onto the roles, picking the rung by the weight already at the call site so a 12px label that was `font-medium` becomes `column` and a plain one becomes `caption`.

The sign-in and onboarding screens dropped a private palette that re-declared `--surface*`, `--neutral*`, `--border*` and `color-scheme: dark` locally, which pinned those two pages to dark while the rest of the app followed the theme. The decorative halftone canvas reads its stage hues from `--chart-1/2/4/3` instead of four hardcoded hex values, and re-reads them when the theme class changes, since a canvas cannot inherit a token the way a border can.
