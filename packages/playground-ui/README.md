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

A field in an error state sets `--field-rim` and `--field-rim-focus` to `--destructive-indicator`, so the red outline shows on every surface and stays red while focused.

If your app generates additional semantic utilities, import `@mastra/playground-ui/theme.css` into its Tailwind stylesheet so Tailwind can read the `@theme inline` mappings.

### Brand colors

The fixed Mastra palette is available as `--color-brand-green`, `--color-brand-orange`, `--color-brand-pink`, `--color-brand-purple`, `--color-brand-blue`, `--color-brand-red`, and `--color-brand-yellow`. These values do not change with the theme. Utilities use names such as `bg-brand-green`.

### Chromatic roles

Eight shared ramps (`red`, `orange`, `amber`, `green`, `cyan`, `blue`, `purple`, and `pink`) run from `50` to `950`. Status roles select steps from those ramps for each theme:

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

The same four suffixes apply to `destructive`, `warning`, and `info`. Backgrounds are opaque. Use `-subtle-foreground` only for text on a `-subtle` surface. Dots, bars, chart marks, and invalid-field borders use `-indicator`. Standalone destructive and warning text and icons use `--destructive-foreground` and `--warning-foreground`, because those indicator fills are too light to read as text in light mode. Success and info text use `-indicator`. The filled destructive button uses `--fill-destructive` and its hover, active, and disabled steps, with `--fill-destructive-foreground` for its text.

Product roles use `--product-{name}` and `--product-{name}-foreground`. Names are `studio`, `server`, `observability`, `factory`, `workers`, and `persistent-server`. Use `ProductAvatar` for the round icon and `ProductBadge` for the icon with its label. Both take a `product` prop and use the matching semantic colors.

```tsx
import { ProductAvatar } from '@mastra/playground-ui/components/ProductAvatar';
import { ProductBadge } from '@mastra/playground-ui/components/ProductBadge';

<ProductAvatar product="studio" />
<ProductBadge product="persistent-server" />
```

Charts use hue-named roles for categories (`--chart-blue`, `--chart-blue-deep`, `--chart-amber`, `--chart-green`, `--chart-purple`, `--chart-orange`, `--chart-pink`, `--chart-red`) and `--chart-sequential-1` through `--chart-sequential-5` for ordered values. Span colors use `--span-agent`, `--span-workflow`, and the other span names. Pastel chart colors are fills, not text colors; keep labels on `--foreground` or `--muted-foreground`.

Numbered `accent*` tokens, `positive1`, `negative1`, `warning1`, `notice-success/destructive/warning/info`, and `--brand-green-*` are removed. The `yellow` ramp is now `amber`: `--yellow-*`, `--yellow-soft-*`, `--badge-yellow-*`, `--chart-yellow`, and the Badge `yellow` tone are removed in favor of their `amber` names. `--color-brand-yellow` is unchanged. Status consumers use the existing `success`, `destructive`, `warning`, or `info` roles. Focus styling uses `border-focus`; categorical charts and span icons use their own roles. CodeMirror uses five local `--syntax-*` properties scoped to `.cm-editor`, not a global palette.

Every badge hue (`green`, `red`, `amber`, `blue`, `purple`, `orange`, `cyan`, `pink`) is a categorical tone built from the ramps, with `--badge-{hue}-strong`, `-subtle`, `-edge`, `-foreground`, and `-indicator`. `-strong` and `-subtle` are the fills behind `emphasis="strong"` and `emphasis="subtle"`. Badge backgrounds are translucent tints, so a badge follows the surface under it when a card or row changes on hover: `--{hue}-600` at 32% (strong) and 13% (subtle) in dark mode, `--{hue}-400` at 20% and 10% in light mode. On a resting card they match the solid fills they replaced. Product avatars stay solid (`--{hue}-soft-900` / `--{hue}-soft-950` in dark mode, `--{hue}-100` / `--{hue}-50` in light mode) because they overlap each other. The soft steps keep the lightness and hue of `900`/`950` at 75% chroma, and are available as utilities such as `bg-green-soft-900`. `--badge-{hue}-indicator` colors dots, icons, and labels for a category: `--{hue}-soft-300` in dark mode and `--{hue}-soft-600` in light mode, which hold every hue at the same 0.1 chroma so no hue shouts. Use the status role with `-subtle`, `-edge`, `-subtle-foreground`, or `-indicator` for its intended job. Notice variants are unchanged. Badge status variants are `success`, `destructive`, `warning`, and `info`, for states. `green`, `red`, `amber`, and `blue` are categorical tones like `purple` and `orange`, for labels that are not states. `Badge` takes `emphasis="strong"` (the default) or `emphasis="subtle"` (a quieter tinted fill). Use `--green-*` for the shared chromatic ramp.

#### Opacity and literal colors

A resting color never depends on what sits behind it. Surfaces, text, borders, notices, status, product, and chart colors are solid ramp steps in both themes, and span colors are solid values in `data-viz.css` at one lightness per theme, whatever layer they sit on.

Opacity is allowed only through design-system tokens, for layers whose job is to show what is underneath:

- State layers over an existing surface: `fill`, `fill-subtle`, `fill-hover`, `fill-active`, and `fill-strong`.
- Scrims and overlays: `scrim`.
- Badge fills: `badge-{hue}-strong` and `badge-{hue}-subtle`, so a badge tints with the card or row it sits on.
- Neutral hairlines: `border`, `border-strong`, `surface-rim`, and `gray-alpha-*`.
- Effects that fade, glow, or animate inside a design-system component, such as the Composer ring and the sidebar meter bloom.

Product code does not add opacity modifiers (`bg-green-500/20`) or `color-mix()` to chromatic colors, and does not write literal colors (`#hex`, `rgb()`, `oklch()`) outside the theme. Masks, brand marks, and screens that render before the theme loads are the exceptions. `src/color-rules.test.ts` enforces this across playground-ui, Studio, and Factory.

To migrate removed tokens:

| Removed token                                         | Replacement                                       |
| ----------------------------------------------------- | ------------------------------------------------- |
| `--chart-soft-N`                                      | `--chart-sequential-N`                            |
| `--span-type-NAME`                                    | `--span-NAME`                                     |
| `accent1`, `positive1`                                | `success-*`                                       |
| `accent2`, `negative1`                                | `destructive-*`                                   |
| `accent6`, `warning1`                                 | `warning-*`                                       |
| `accent3`, `accent5`                                  | `info-*`                                          |
| `error`                                               | `destructive-indicator`                           |
| `notice-STATUS`                                       | `STATUS-subtle`, `STATUS-subtle-foreground`       |
| `--brand-green-N`                                     | `--green-N`                                       |
| `destructive`, `destructive-foreground`               | `fill-destructive`, `fill-destructive-foreground` |
| `badge-HUE`, `badge-HUE-fg`                           | `badge-HUE-strong`, `badge-HUE-foreground`        |
| `notice-note`, `notice-note-fg`                       | `muted`, `foreground`                             |
| `--ring`, `ring-ring`                                 | `--border-focus`, `ring-border-focus`             |
| `--shadow-focus-ring`, `--focus-halo`                 | none; focus has no halo                           |
| `--surface-rim-focus`, `--field-rim-focus-on-surface` | `--border-focus`                                  |
| `focusRing.visible` and siblings                      | `focusRing`, or `focusRingInset` in clipped rows  |

Keyboard focus is a 1px `--border-focus` outline on `:focus-visible`, and the base layer draws it on any focusable element that does not style its own. `focusRing` from `primitives/transitions` applies it explicitly, `focusRingInset` draws it inside a full-bleed row whose edge is clipped, and `focusRingOffset` sets it 2px out on checkboxes, radios, switches, and filled `primary` and `destructive` buttons, where a flush line vanishes into the fill. It is an outline, not a `ring-*`, because a ring rewrites `box-shadow` and would erase a raised surface's rim. Fields, buttons, and clickable cards show focus on that rim instead: `surfaceRimFocus` from `primitives/form-element` repaints it to `--border-focus`, the same colour and weight, and the surface keeps its elevation.

`SankeyChart` accepts `getNodeColor` and `getLinkColor` callbacks returning CSS colors. Explicit link colors keep the default link transparency and hover emphasis:

```tsx
<SankeyChart getNodeColor={() => 'var(--span-agent)'} getLinkColor={() => 'var(--chart-blue)'} />
```

Foundations/Color has one story each for monochrome and chromatic ramps, semantic roles, products, charts, span types, and brand colors. Badge and avatar examples live in Elements/Products; the semantic Sankey example lives in Metrics/SankeyChart.

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
