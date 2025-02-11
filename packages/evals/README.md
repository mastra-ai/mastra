# @mastra/evals

A comprehensive evaluation framework for assessing AI model outputs across multiple dimensions.

## Installation

```bash
npm install @mastra/evals
```

## Overview

`@mastra/evals` provides a suite of evaluation metrics for assessing AI model outputs. The package includes both LLM-based and NLP-based metrics, enabling both automated and model-assisted evaluation of AI responses.

## Features

### LLM-Based Metrics

1. **Answer Relevancy**

   - Evaluates how well an answer addresses the input question
   - Considers uncertainty weighting for more nuanced scoring
   - Returns detailed reasoning for scores

2. **Bias Detection**

   - Identifies potential biases in model outputs
   - Analyzes opinions and statements for bias indicators
   - Provides explanations for detected biases
   - Configurable scoring scale

3. **Context Precision & Relevancy**

   - Assesses how well responses use provided context
   - Evaluates accuracy of context usage
   - Measures relevance of context to the response
   - Analyzes context positioning in responses

4. **Faithfulness**

   - Verifies that responses are faithful to provided context
   - Detects hallucinations or fabricated information
   - Evaluates claims against provided context
   - Provides detailed analysis of faithfulness breaches

5. **Prompt Alignment**

   - Measures how well responses follow given instructions
   - Evaluates adherence to multiple instruction criteria
   - Provides per-instruction scoring
   - Supports custom instruction sets

6. **Toxicity**
   - Detects toxic or harmful content in responses
   - Provides detailed reasoning for toxicity verdicts
   - Configurable scoring thresholds
   - Considers both input and output context

### NLP-Based Metrics

1. **Completeness**

   - Analyzes structural completeness of responses
   - Identifies missing elements from input requirements
   - Provides detailed element coverage analysis
   - Tracks input-output element ratios

2. **Content Similarity**

   - Measures text similarity between inputs and outputs
   - Configurable for case and whitespace sensitivity
   - Returns normalized similarity scores
   - Uses string comparison algorithms for accuracy

3. **Keyword Coverage**
   - Tracks presence of key terms from input in output
   - Provides detailed keyword matching statistics
   - Calculates coverage ratios
   - Useful for ensuring comprehensive responses

## Usage

### Basic Example

```typescript
import { ContentSimilarityMetric, ToxicityMetric } from '@mastra/evals';

// Initialize metrics
const similarityMetric = new ContentSimilarityMetric({
  ignoreCase: true,
  ignoreWhitespace: true,
});

const toxicityMetric = new ToxicityMetric({
  model: openai('gpt-4'),
  scale: 1, // Optional: adjust scoring scale
});

// Evaluate outputs
const input = 'What is the capital of France?';
const output = 'Paris is the capital of France.';

const similarityResult = await similarityMetric.measure(input, output);
const toxicityResult = await toxicityMetric.measure(input, output);

console.log('Similarity Score:', similarityResult.score);
console.log('Toxicity Score:', toxicityResult.score);
```

### Context-Aware Evaluation

```typescript
import { FaithfulnessMetric } from '@mastra/evals';

// Initialize with context
const faithfulnessMetric = new FaithfulnessMetric({
  model: openai('gpt-4'),
  context: ['Paris is the capital of France', 'Paris has a population of 2.2 million'],
  scale: 1,
});

// Evaluate response against context
const result = await faithfulnessMetric.measure(
  'Tell me about Paris',
  'Paris is the capital of France with 2.2 million residents',
);

console.log('Faithfulness Score:', result.score);
console.log('Reasoning:', result.reason);
```

## Metric Results

Each metric returns a standardized result object containing:

- `score`: Normalized score (typically 0-1)
- `info`: Detailed information about the evaluation
- Additional metric-specific data (e.g., matched keywords, missing elements)

Some metrics also provide:

- `reason`: Detailed explanation of the score
- `verdicts`: Individual judgments that contributed to the final score

## Telemetry and Logging

The package includes built-in telemetry and logging capabilities:

- Automatic evaluation tracking through Mastra Storage
- Integration with OpenTelemetry for performance monitoring
- Detailed evaluation traces for debugging

```typescript
import { attachListeners } from '@mastra/evals';

// Enable evaluation tracking
await attachListeners();
```

## Environment Variables

Required for LLM-based metrics:

- `OPENAI_API_KEY`: For OpenAI model access
- Additional provider keys as needed (Cohere, Anthropic, etc.)

## Package Exports

```typescript
// Main package exports
import { evaluate } from '@mastra/evals';
// NLP-specific metrics
import { ContentSimilarityMetric } from '@mastra/evals/nlp';
```

## Related Packages

- `@mastra/core`: Core framework functionality
- `@mastra/engine`: LLM execution engine
- `@mastra/mcp`: Model Context Protocol integration
