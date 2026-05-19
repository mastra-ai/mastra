---
'@mastra/playground-ui': patch
---

Refreshed Button + Card design system tokens.

**Button variants**: consolidated to `default`, `primary`, `outline`, `ghost`. The `cta`, `contrast`, and unused `link` variants have been removed.

```tsx
// Before
<Button variant="cta">Save</Button>
<Button variant="primary">Submit</Button>  // surface4 fill, low contrast

// After
<Button variant="primary">Save</Button>     // high-contrast neutral6 fill, theme-aware
<Button variant="primary">Submit</Button>
```

Migrate existing `cta` usages to `primary`.

**New tokens**: `--border-subtle`, `--border-strong`, `--surface-overlay-soft`, `--surface-overlay-strong` — alpha overlays of the opposite-theme color, tuned for dark/light parity. Used by `Button` (default), `SectionCard`, and `DashboardCard` so cards read consistently on any surface.

**Other**:

- DashboardCard radius reduced to `rounded-xl` and padding tightened to `px-4 py-3` for better grid density.
- SectionCard wrapper no longer fills its background — header strip + border carry definition.
- Dark surface2/surface3 darkened slightly (16.84% → 16%, 19.13% → 18%) so the main frame reads as a distinct surface.
- Removed deprecated `--section-card-*` tokens and utilities.
