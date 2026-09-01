# @mastra/evals

Scorers and evaluation utilities for measuring the quality of Mastra agent and workflow runs. It includes prebuilt scorers, checks, utilities, and Vitest integration.

## Installation

```bash
npm install @mastra/evals
```

## Usage

Import prebuilt scorers from the package subpath.

```typescript
import { createToolCallAccuracyScorerCode } from '@mastra/evals/scorers/prebuilt';

const scorer = createToolCallAccuracyScorerCode({ expectedTool: 'weather' });
```

## Documentation

- [@mastra/evals documentation](https://mastra.ai/docs/evals/overview)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/packages/evals/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
