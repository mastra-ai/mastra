# @mastra/playground-ui

Reusable React components, hooks, domains, and design tokens used by Mastra Studio. It provides the UI building blocks for logs, memory, metrics, traces, and agent management.

## Installation

```bash
npm install @mastra/playground-ui
```

## Usage

Import the package styles once in your React application.

```tsx
import '@mastra/playground-ui/style.css';
import { Button } from '@mastra/playground-ui/components/Button';

export function SaveButton() {
  return <Button>Save</Button>;
}
```

### Semantic color tokens

`theme.css` declares the semantic color tokens (`--background`, `--card`, `--foreground`, and friends) at the document root, so utilities such as `bg-card` and `text-foreground` resolve anywhere in the app, portalled content included. Importing `style.css` once is enough to get both the compiled utilities and those tokens.

Semantic values follow the existing `html.light` mode; dark mode is the default. Override `--card`, `--foreground`, or another semantic variable on an element to recolor its subtree.

If your app generates additional semantic utilities, import `@mastra/playground-ui/theme.css` into its Tailwind stylesheet so Tailwind can read the `@theme inline` mappings.

### Brand colors

The fixed Mastra palette is available as `--color-ds-green`, `--color-ds-orange`, `--color-ds-pink`, `--color-ds-purple`, `--color-ds-blue`, `--color-ds-red`, and `--color-ds-yellow`. These values do not change with the theme. Utilities use names such as `bg-ds-green`.

### Chromatic roles

Eight shared ramps (`red`, `orange`, `yellow`, `green`, `cyan`, `blue`, `purple`, and `pink`) run from `50` to `950`. Status roles select steps from those ramps for each theme:

```css
.status {
  background: var(--success-bg);
  border: 1px solid var(--success-border);
  color: var(--success-fg);
}

.status-dot {
  background: var(--success-indicator);
}
```

The same four suffixes apply to `destructive`, `warning`, and `info`. Backgrounds are opaque. Indicators are for dots and small marks, not filled-button backgrounds.

Product roles use `--product-{name}-bg` and `--product-{name}-fg`. Names are `studio`, `server`, `observability`, `factory`, `workers`, and `persistent-server`. Use `ProductAvatar` for the round icon and `ProductBadge` for the icon with its label. Both take a `product` prop and use the matching semantic colors.

```tsx
import { ProductAvatar } from '@mastra/playground-ui/components/ProductAvatar';
import { ProductBadge } from '@mastra/playground-ui/components/ProductBadge';

<ProductAvatar product="studio" />
<ProductBadge product="persistent-server" />
```

Charts use `--chart-1` through `--chart-8` for categories and `--chart-sequential-1` through `--chart-sequential-5` for ordered values. Span colors use `--span-agent`, `--span-workflow`, and the other span names. Pastel chart colors are fills, not text colors; keep labels on `--foreground` or `--muted-foreground`.

Numbered `accent*` tokens and `positive1`, `negative1`, and `warning1` remain in `legacy-theme.css`, imported by `theme.css` for existing consumers. Status consumers use the existing `success`, `destructive`, `warning`, or `info` roles. Focus styling uses `border-focus`; categorical charts and span icons use their own roles. CodeMirror uses five local `--syntax-*` properties scoped to `.cm-editor`, not a global palette.

The duplicated `notice-success/destructive/warning/info` and `badge-green/red/yellow/blue` color aliases are also retained in the compatibility theme. Use the status role with `-bg`, `-border`, `-fg`, or `-indicator` for its intended job. Notice variants are unchanged. Badge status variants are now `success`, `destructive`, `warning`, and `info`, with `green`, `red`, `yellow`, and `blue` retained as compatibility aliases; categorical variants are unchanged. New consumers use `--green-*` for the shared chromatic ramp, not Mastra brand green. `--brand-green-*` remains in the compatibility theme.

To migrate chart consumers:

| Removed token       | Replacement            |
| ------------------- | ---------------------- |
| `--chart-blue`      | `--chart-1`            |
| `--chart-blue-deep` | `--chart-2`            |
| `--chart-yellow`    | `--chart-3`            |
| `--chart-green`     | `--chart-4`            |
| `--chart-purple`    | `--chart-5`            |
| `--chart-orange`    | `--chart-6`            |
| `--chart-pink`      | `--chart-7`            |
| `--chart-red`       | `--chart-8`            |
| `--chart-soft-N`    | `--chart-sequential-N` |
| `--span-type-NAME`  | `--span-NAME`          |

`SankeyChart` accepts `getNodeColor` and `getLinkColor` callbacks returning CSS colors. Explicit link colors keep the default link transparency and hover emphasis:

```tsx
<SankeyChart getNodeColor={() => 'var(--span-agent)'} getLinkColor={() => 'var(--chart-1)'} />
```

Foundations/Color has separate stories for ramps, semantic colors, product colors, charts, span types, and brand colors. Badge and avatar examples live in Elements/Products; the semantic Sankey example lives in Metrics/SankeyChart.

## Documentation

This README is the package guide. Import the global stylesheet once, then use the package's explicit `components/*`, `domains/*`, `hooks/*`, `icons/*`, `primitives/*`, `store/*`, `tokens`, and `utils/*` entry points rather than a package-root import.

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/packages/playground-ui/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
