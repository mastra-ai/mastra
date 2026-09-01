# @mastra/evals

`@mastra/evals` ships a collection of scoring utilities you can run locally or inside your own evaluation pipelines. These scorers come in two flavors:

- **LLM scorers** – leverage a judge model (e.g. OpenAI, Anthropic) to rate responses for qualities such as faithfulness or toxicity.
- **Code/NLP scorers** – deterministic heuristics (keyword coverage, similarity, etc.) that do not require an external model.

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
