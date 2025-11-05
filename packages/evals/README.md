# @mastra/evals

`@mastra/evals` ships a collection of scoring utilities you can run locally or inside your own evaluation pipelines. These scorers come in two flavors:

- **LLM scorers** – leverage a judge model (e.g. OpenAI, Anthropic) to rate responses for qualities such as faithfulness or toxicity.
- **Code/NLP scorers** – deterministic heuristics (keyword coverage, similarity, etc.) that do not require an external model.

The scorers do not persist results or integrate with Mastra Storage; you decide where and how to record outcomes.

## Installation

```bash
npm install @mastra/evals
```

## Quick Start

```ts
import { createFaithfulnessScorer, createContentSimilarityScorer } from '@mastra/evals/scorers/prebuilt';

const faithfulness = createFaithfulnessScorer({
   model: 'openai/gpt-4o-mini')
});

const similarity = createContentSimilarityScorer({ ignoreCase: true });

const answer = 'Paris is the capital of France.';
const context = ['Paris is the capital of France', 'France is in Europe'];

const faithfulnessScore = await faithfulness.score({ answer, context });

const similarityScore = similarity.score({
   input: context[0],
   output: answer
});

console.log({ faithfulnessScore, similarityScore });
```
