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

## Opt-in semantic theme

`SidebarNew` imports `new-theme.css` and applies `mastra-theme` to its root, including the mobile drawer. Keep importing `style.css` once in the app: it provides the compiled utilities. The theme import only adds scoped token values.

For other components, import the theme and apply its scope where semantic colors are needed:

```tsx
import '@mastra/playground-ui/new-theme.css';

export function SummaryCard() {
  return <div className="mastra-theme bg-mastra-card text-mastra-foreground">Summary</div>;
}
```

The `mastra-` color names avoid changing a host app's `bg-card` or `--card`. Semantic values follow the existing `html.light` mode; dark mode is the default. Override `--mastra-card`, `--mastra-foreground`, or another semantic variable on the themed element to customize it.

Portalled content using semantic colors also needs `mastra-theme` on its popup root, since it renders outside the component's DOM subtree. The class supplies default values; custom overrides on the trigger's ancestors must also be applied to the popup.

If your app generates additional semantic utilities, import `@mastra/playground-ui/new-theme.css` into its Tailwind stylesheet so Tailwind can read the `@theme inline` mappings.

## Documentation

This README is the package guide. Import the global stylesheet once, then use the package's explicit `components/*`, `domains/*`, `hooks/*`, `icons/*`, `primitives/*`, `store/*`, `tokens`, and `utils/*` entry points rather than a package-root import.

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/packages/playground-ui/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
