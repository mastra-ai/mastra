---
'@mastra/playground-ui': minor
---

Added chromatic color ramps and theme-aware status, badge, product, chart, and span colors. Every resting color is now a solid ramp step in both themes, so a badge or notice looks the same whatever surface it sits on.

**What you get**

- Eight ramps (`red`, `orange`, `yellow`, `green`, `cyan`, `blue`, `purple`, `pink`) from `50` to `950`, plus low-chroma `--{hue}-soft-300/600/900/950` steps. Utilities such as `bg-green-soft-900` are generated.
- Status roles for states: `{status}-subtle`, `-subtle-active`, `-edge`, `-indicator`, and `-subtle-foreground`, where `{status}` is `success`, `destructive`, `warning`, or `info`.
- Categorical badge roles for labels that are not states: `badge-{hue}-strong`, `-subtle`, `-edge`, `-foreground`, and `-indicator`.
- Product roles: `product-{name}`, `-subtle`, and `-foreground` for `studio`, `server`, `observability`, `factory`, `workers`, and `persistent-server`, with new `ProductAvatar` and `ProductBadge` components and product `Badge` variants.
- The fixed Mastra brand palette as `--color-brand-{hue}` (utilities such as `bg-brand-green`). It does not change with the theme.
- Chart roles keep their hue names (`--chart-blue`, `--chart-green`, …) plus `--chart-sequential-1` to `-5`, and resolve from the ramps. Span roles are `--span-agent`, `--span-workflow`, and so on, each on its own hue.
- `Badge` status variants `success`, `destructive`, `warning`, and `info`. `green`, `red`, `yellow`, and `blue` are categorical tones like `purple` and `orange`.
- Optional `getNodeColor` and `getLinkColor` callbacks on `SankeyChart`.

```css
.status {
  background: var(--success-subtle);
  border: 1px solid var(--success-edge);
  color: var(--success-subtle-foreground);
}

.status-dot {
  background: var(--success-indicator);
}
```

**Breaking: removed color tokens**

The numbered accent tokens (`accent1`–`accent6` and their `Dark`/`Darker` variants), `positive1`, `negative1`, `warning1`, `error`, the `notice-*` tokens, `--brand-green-*`, `--chart-soft-*`, `--span-type-*`, `destructive`, and `destructive-foreground` are removed, along with their `Colors` entries. The old `badge-{hue}` fill and `badge-{hue}-fg` tokens are renamed. See the playground-ui README for the full table.

```tsx
// Before
<span className="bg-notice-success text-notice-success-fg">Saved</span>
<span className="bg-badge-green text-badge-green-fg">Label</span>
<button className="bg-destructive text-destructive-foreground">Delete</button>
<path stroke="var(--chart-soft-1)" />
<Icon style={{ color: 'var(--span-type-agent)' }} />

// After
<span className="bg-success-subtle text-success-subtle-foreground">Saved</span>
<span className="bg-badge-green-strong text-badge-green-foreground">Label</span>
<Button variant="destructive">Delete</Button>
<path stroke="var(--chart-sequential-1)" />
<Icon style={{ color: 'var(--span-agent)' }} />
```

Standalone status text, icons, dots, bars, and invalid-field borders use `{status}-indicator`. `{status}-subtle-foreground` is only for text on a `{status}-subtle` surface. A filled destructive control uses `fill-destructive` and its `-hover`, `-active`, `-disabled`, and `-foreground` steps.

**Breaking: `Badge` emphasis**

`emphasis` values are now `strong` (the default) and `subtle`, instead of `default` and `muted`. `subtle` now also applies to product variants.

```tsx
// Before
<Badge variant="purple" emphasis="muted">Draft</Badge>

// After
<Badge variant="purple" emphasis="subtle">Draft</Badge>
```

**Breaking: `@mastra/playground-ui/utils/colors`**

Generated `hsl()` colors are gone. `stringToColor`, `themedHueColor`, and `stringToThemedColor` are replaced by `hueForName`, which returns a stable categorical hue for any name, and `hueFillClass`, `hueAccentColor`, and `hueColors`, which resolve to theme-aware badge tokens. `hueForName` never returns `red`, so a hashed label cannot be mistaken for an error.

```tsx
// Before
import { stringToColor } from '@mastra/playground-ui/utils/colors';
<span style={{ backgroundColor: stringToColor(tag) }}>{tag}</span>;

// After
import { hueFillClass, hueForName } from '@mastra/playground-ui/utils/colors';
<span className={hueFillClass(hueForName(tag))}>{tag}</span>;
```

`BADGE_COLORS` and topic colors return theme variables such as `var(--badge-purple-indicator)` instead of hex values.

**Breaking: `SankeyChart`**

Nodes and ribbons are colored from the chart series tokens, and a label keeps its color when other nodes are added or removed. `buildSankeyHueMap`, `hashHue`, `nodeColor`, and `nodeColorVivid` are replaced by `buildSankeyColorMap` and `sankeySeriesColors`. `Sankey`'s `getColumnHue` is now `getColumnColor` and returns a CSS color.

```tsx
// Before
<Sankey getColumnHue={column => getSignalHue(column.id)} />

// After
<Sankey getColumnColor={column => getSignalColor(column.id)} />
```

**Breaking: `@mastra/playground-ui/ee/signals/signal-colors`**

`SIGNAL_HUES` and `getSignalHue` are no longer exported. Use `getSignalColor` for a CSS color, and `getSignalAreaClass` or `getSignalConnectorClass` for SVG fill and stroke classes.

```tsx
// Before
import { getSignalHue } from '@mastra/playground-ui/ee/signals/signal-colors';
const hue = getSignalHue('goal');

// After
import { getSignalColor } from '@mastra/playground-ui/ee/signals/signal-colors';
const color = getSignalColor('goal');
```

**Other changes**

- Tool approval buttons read `Approved` or `Declined` after a decision, and their accessible names follow (`Approved search`, `Declined search`).
- Ramp steps stay inside sRGB. Chart, span, and syntax roles are picked to stay distinguishable under common color-vision deficiencies and to meet 3:1 against the page in both themes. The sequential chart scale runs light-to-dark in light mode and dark-to-light in dark mode.
- Scorer spans are pink, and workspace, memory, and provider spans are now on clearly separate hues.
- Light-mode destructive buttons darken on hover and press, like dark mode.
- Notes in `Notice` use the neutral `muted` surface.
- CodeMirror syntax colors are scoped to `.cm-editor`.
