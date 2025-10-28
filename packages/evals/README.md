# @mastra/evals

> **Status:** Feature-focused on reusable scorers. Legacy “eval storage” capabilities have been removed from Mastra.

`@mastra/evals` now ships a collection of scoring utilities you can run locally or inside your own evaluation pipelines. These scorers come in two flavors:

- **LLM scorers** – leverage a judge model (e.g. OpenAI, Anthropic) to rate responses for qualities such as faithfulness or toxicity.
- **Code/NLP scorers** – deterministic heuristics (keyword coverage, similarity, etc.) that do not require an external model.

The scorers do not persist results or integrate with Mastra Storage; you decide where and how to record outcomes.

## Installation

```bash
npm install @mastra/evals
```

## Quick Start

```ts
import { FaithfulnessScorer } from '@mastra/evals/scorers/llm';
import { ContentSimilarityScorer } from '@mastra/evals/scorers/code';
import { openai } from '@mastra/engine/providers';

const faithfulness = new FaithfulnessScorer({ model: openai('gpt-4.1-mini') });
const similarity = new ContentSimilarityScorer({ ignoreCase: true });

const answer = 'Paris is the capital of France.';
const context = ['Paris is the capital of France', 'France is in Europe'];

const faithfulnessScore = await faithfulness.score({ answer, context });
const similarityScore = similarity.score({ input: context[0], output: answer });

console.log({ faithfulnessScore, similarityScore });
```

## Available Scorers

### LLM-backed

- `AnswerRelevancyScorer`
- `AnswerSimilarityScorer`
- `BiasScorer`
- `ContextPrecisionScorer`
- `ContextRelevanceScorer`
- `FaithfulnessScorer`
- `HallucinationScorer`
- `NoiseSensitivityScorer`
- `PromptAlignmentScorer`
- `ToolCallAccuracyScorer`
- `ToxicityScorer`

Each accepts a `model` plus metric-specific options. Outputs include a normalized score (0–1) and structured reasoning returned by the judge model.

### Code/NLP

- `CompletenessScorer`
- `ContentSimilarityScorer`
- `KeywordCoverageScorer`
- `TextualDifferenceScorer`
- `ToneScorer`
- `ToolCallAccuracyScorer`

These are synchronous utilities that analyze strings, keyword lists, or structured tool-call payloads. They return consistent scoring objects without network calls.

## Scorer API Shape

Every scorer exposes a `score()` method and returns:

```ts
type ScoreResult = {
  score: number; // 0 - 1
  details?: Record<string, any>; // metric-specific metadata
  reasoning?: string; // provided by LLM scorers when available
};
```

LLM scorers are async and may throw if the backing provider fails. Code scorers are synchronous.

## Custom Pipelines

The package intentionally does not impose orchestration, persistence, or scheduling. Recommended pattern:

1. Gather the conversation/input/output you want to score.
2. Run one or more scorers locally.
3. Persist the results in your own database, spreadsheet, or observability tool of choice.
4. Optionally wire scores into CI gates or dashboards.

## Removal of Legacy Eval Storage

Older Mastra releases included helpers that wrote eval rows to database adapters and exposed `MastraClient` endpoints. Those features were removed in April 2025. This package continues to distribute the scorer implementations so teams can keep using the logic without depending on Mastra-managed storage.

## Contributing / Feedback

Have a new metric idea or improvements to the existing heuristics? Open an issue or PR in the Mastra repository. Community contributions to scorers are welcome.
