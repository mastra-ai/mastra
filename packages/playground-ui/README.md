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

## Documentation

This README is the package guide. Import the global stylesheet once, then use the package's explicit `components/*`, `domains/*`, `hooks/*`, `icons/*`, `primitives/*`, `store/*`, `tokens`, and `utils/*` entry points rather than a package-root import.

## Focus styling

The stylesheet supplies a `:focus-visible` outline for native controls and custom focusable elements. Shared components choose their focus treatment automatically: Button uses its text or icon size, Tabs uses a contour, and Input uses its field border. No focus classes are needed where these components are used.

Use InputGroup for a field with adjacent controls. The group shows the field indicator while its input is focused; an action button inside the group keeps its own indicator. Unstyled inputs retain the default outline when used outside a field group. Invalid fields keep their error border and a separate focus outline.

Focus treatments belong in shared components. Studio lint rejects local outline suppression and focus ring/shadow utilities. Inside the design system, a custom treatment may suppress the default only when it supplies a replacement; a bare `ds-focus` class or a contour without its decoration keeps the fallback outline. Editor and chart integrations may manage their own indicators.

The `Primitives/Focus` stories cover fallback controls, composite fields, comboboxes, row actions, tooltip headers, disabled tabs, and scroll boundaries. Check rendered keyboard behavior, both themes, reduced motion, and forced colors when changing a treatment.

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/packages/playground-ui/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
