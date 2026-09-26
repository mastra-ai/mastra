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

#### Surfaces

| Token          | Utility         | Used for                                                                            |
| -------------- | --------------- | ----------------------------------------------------------------------------------- |
| `--background` | `bg-background` | The page canvas                                                                     |
| `--sidebar`    | `bg-sidebar`    | App chrome, one step behind the canvas                                              |
| `--card`       | `bg-card`       | Cards, panels, settings sections                                                    |
| `--popover`    | `bg-popover`    | Menus, dropdowns, tooltips                                                          |
| `--dialog`     | `bg-dialog`     | Dialogs, drawers, alert dialogs. Off-white in light mode so fields inside stand out |
| `--muted`      | `bg-muted`      | A quiet region inside a container                                                   |

#### Fields

Text fields, textareas, input groups, and the default Select, Combobox, and DateTimePicker triggers read their fill and outline from these tokens. You don't set them at the call site: cards, overlays, and dialogs set them for every field inside, so a field is never darker than the surface it sits on.

| Token                | Utility             | Used for                                                                                 |
| -------------------- | ------------------- | ---------------------------------------------------------------------------------------- |
| `--field`            | `bg-field`          | Field fill. `--card` on the page, `--field-on-surface` inside a card, overlay, or dialog |
| `--field-on-surface` | none                | Field fill inside a surface: one step lighter in dark mode, white in light mode          |
| `--field-disabled`   | `bg-field-disabled` | Disabled field fill                                                                      |
| `--field-rim`        | none                | Resting outline. Stronger inside white surfaces in light mode                            |
| `--field-rim-focus`  | none                | Focus outline                                                                            |

A field in an error state sets `--field-rim` and `--field-rim-focus` to `--destructive`, so the red outline shows on every surface and stays red while focused.

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

### Typography

Text uses roles, not sizes. A role such as `body-sm` or `caption` sets size, line height, weight, and tracking together. Render text with `Txt`, or use the matching `text-<role>` utility inside a component's own markup.

```tsx
import { Txt } from '@mastra/playground-ui/components/Txt';

<Txt variant="body-sm" tone="muted">
  Last run
</Txt>;
```

#### Monospace

Monospace is a typeface, not another role. `font="mono"` swaps the family to `--font-mono` and keeps the role's size, line height, and weight, so a mono value lines up with the proportional text around it.

```tsx
<Txt variant="caption" font="mono" tone="muted">
  run_01JQX8K2M4
</Txt>
```

| Use mono for                                       | Keep in the body face                     |
| -------------------------------------------------- | ----------------------------------------- |
| Model and resource IDs, versions, and hashes       | Labels, field names, and column headers   |
| Timestamps and durations: `Sep 23, 12:42`, `412ms` | Counts, costs, scores, and percentages    |
| Log lines                                          | Headings and page titles                  |
| Values a user copies or compares by character      | Status text and badges that name a state  |
|                                                    | Prose, descriptions, and empty-state copy |

Time is mono: a timestamp marks a moment and a duration measures one, and both are machine values a user compares digit by digit. Other numbers (counts, costs, scores, percentages) stay in the body face; add `tabular-nums` where their digits should line up, such as table columns. Data visualization is the exception: KPI values, chart axes, and chart tooltips stay in the body face with `tabular-nums`, even for timestamps and durations, so a row of KPIs or a set of charts reads in one face.

Mono pairs with the text roles: `body` for logs, `body-sm` for values in tables and fields, `caption` for secondary identifiers, and `meta` for compact values such as versions. Heading roles stay proportional.

Product code never writes the `font-mono` class, and lint rejects it outside the design system. Use `Txt font="mono"` for identifiers, timestamps, and durations, `InlineCode` or `CodeBlock` for code, and `tabular-nums` for numbers. A raw `<pre>` or `<code>` element is already monospace.

`--font-mono` defaults to the system monospace stack. Override it in an unlayered rule in your own CSS to use a product face, and every mono value follows.

At the same font size, a monospace face usually looks larger than the body face because its lowercase letters are taller. Set `--font-mono-size-adjust` to the body face's x-height ratio and mono text scales to match it. Measure the ratio for your body face; `0.508` is Mona Sans. Keycaps (`kbd`) keep their full size, because they are single capitals and x-height matching would only shrink them.

```css
:root {
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;
  --font-mono-size-adjust: ex-height 0.508;
}
```

#### Code

Code is always marked as code, never plain mono text. Use `InlineCode` for a snippet, package name, variable, or command inside a sentence. It takes the size and color of the text around it, so it works in muted copy and inside a `Notice`. Use `CodeBlock` for anything longer than one line, and pass `lang` so it is syntax highlighted.

```tsx
import { CodeBlock } from '@mastra/playground-ui/components/CodeBlock';
import { InlineCode } from '@mastra/playground-ui/components/InlineCode';

<Txt variant="body-sm" tone="muted">
  Set <InlineCode>OPENAI_API_KEY</InlineCode> to use this model.
</Txt>

<CodeBlock lang="ts" code={snippet} />
```

## Documentation

This README is the package guide. Import the global stylesheet once, then use the package's explicit `components/*`, `domains/*`, `hooks/*`, `icons/*`, `primitives/*`, `store/*`, `tokens`, and `utils/*` entry points rather than a package-root import.

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/packages/playground-ui/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
