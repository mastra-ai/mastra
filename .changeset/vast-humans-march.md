---
'@mastra/playground-ui': minor
---

Refreshed Button + Card design system tokens.

**Button variants (breaking)**: consolidated to `default`, `primary`, `outline`, `ghost`. The `cta`, `contrast`, and unused `link` variants have been removed. `primary` now uses a high-contrast `neutral6` fill instead of `surface4`, so it reads clearly as the form submit action in both themes.

```tsx
// Before
<Button variant="cta">Save</Button>
<Button variant="contrast">Done</Button>
<Button variant="link">Open</Button>

// After
<Button variant="primary">Save</Button>     // cta → primary (no brand green; theme-aware high contrast)
<Button variant="primary">Done</Button>     // contrast → primary (same recipe, renamed)
<Button as="a" href="…" variant="ghost">Open</Button>  // link → ghost (or plain <a> for inline text links)
```

**New tokens**: `--surface-overlay-soft` and `--surface-overlay-strong` — alpha overlays of the opposite-theme color, used by `SectionCard` header strip and `DashboardCard` fill so cards read consistently on any surface.

**Other**:

- DashboardCard radius reduced to `rounded-xl` and padding tightened to `px-4 py-3` for better grid density.
- SectionCard wrapper no longer fills its background — header strip + border carry definition.
- Dark `surface2` / `surface3` darkened slightly (16.84% → 16%, 19.13% → 18%) so the main frame reads as a distinct surface.
- Dark `border1` / `border2` alphas bumped (6% → 7%, 10% → 11%) for closer dark/light parity.
- Removed deprecated `--section-card-*` tokens and their `@utility` blocks.
