# @mastra/bundler-bun

Bun bundler engine for Mastra. This package provides a fast, native bundling solution using Bun's built-in bundler.

## Installation

```bash
# Using bun
bun add @mastra/bundler-bun

# Using npm
npm install @mastra/bundler-bun

# Using pnpm
pnpm add @mastra/bundler-bun
```

## Requirements

- Bun runtime must be installed and available
- Mastra core package (`@mastra/core`)

## Usage

```typescript
import { Mastra } from '@mastra/core';
import { BunBundlerEngine } from '@mastra/bundler-bun';

export const mastra = new Mastra({
  agents: { myAgent },
  bundler: {
    engine: new BunBundlerEngine(),
    sourcemap: true,
  },
});
```

### With Configuration

```typescript
import { BunBundlerEngine } from '@mastra/bundler-bun';

const engine = new BunBundlerEngine({
  minify: true, // Minify output (default: true)
  target: 'bun', // Target: 'bun' | 'node' | 'browser' (default: 'bun')
  splitting: true, // Enable code splitting (default: true)
  external: ['sharp'], // Additional external packages
});

export const mastra = new Mastra({
  bundler: {
    engine,
  },
});
```

### Using the Factory Function

```typescript
import { createBunEngine } from '@mastra/bundler-bun';

export const mastra = new Mastra({
  bundler: {
    engine: createBunEngine({ minify: true }),
  },
});
```

## Configuration Options

| Option      | Type                           | Default | Description                             |
| ----------- | ------------------------------ | ------- | --------------------------------------- |
| `minify`    | `boolean`                      | `true`  | Whether to minify the output            |
| `target`    | `'bun' \| 'node' \| 'browser'` | `'bun'` | Target environment for the bundle       |
| `splitting` | `boolean`                      | `true`  | Enable code splitting                   |
| `external`  | `string[]`                     | `[]`    | Additional packages to mark as external |

## Why Use Bun Bundler?

- **Speed**: Bun's bundler is significantly faster than traditional JavaScript bundlers
- **Native**: No additional dependencies required when running with Bun
- **Modern**: Built-in support for TypeScript, JSX, and modern JavaScript features
- **Simple**: Minimal configuration required

## License

Apache-2.0
