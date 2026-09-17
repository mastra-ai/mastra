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

### Opt-in semantic theme

`new-theme.css` provides scoped semantic color tokens. Import it and apply `new-theme` to the root of the content using those tokens. Keep importing `style.css` once in the app for the compiled utilities.

```tsx
import '@mastra/playground-ui/new-theme.css';

export function SummaryCard() {
  return <div className="new-theme bg-card text-foreground">Summary</div>;
}
```

The scope limits token defaults, not utility selectors. Classes such as `bg-card` remain global and share the host app's token contract. Audit existing uses before adopting these utilities; a previously ineffective class can start affecting the cascade.

Semantic values follow the existing `html.light` mode; dark mode is the default. Override `--card`, `--foreground`, or another semantic variable on the themed element to customize it.

Portalled content using semantic colors also needs `new-theme` on its portal root, since it renders outside the themed DOM subtree. Apply custom overrides to that root too; values inherited from the trigger's ancestors do not cross the portal.

If your app generates additional semantic utilities, import `@mastra/playground-ui/new-theme.css` into its Tailwind stylesheet so Tailwind can read the `@theme inline` mappings.

## Documentation

This README is the package guide. Import the global stylesheet once, then use the package's explicit `components/*`, `domains/*`, `hooks/*`, `icons/*`, `primitives/*`, `store/*`, `tokens`, and `utils/*` entry points rather than a package-root import.

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/packages/playground-ui/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
