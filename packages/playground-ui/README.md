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

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/packages/playground-ui/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
