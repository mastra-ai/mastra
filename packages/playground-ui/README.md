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

## Documentation

This README is the package guide. Import the global stylesheet once, then use the package's explicit `components/*`, `domains/*`, `hooks/*`, `icons/*`, `primitives/*`, `store/*`, `tokens`, and `utils/*` entry points rather than a package-root import.

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/packages/playground-ui/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
