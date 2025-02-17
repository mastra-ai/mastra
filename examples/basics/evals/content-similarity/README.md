# Content Similarity Metric Example

This example demonstrates how to use Mastra's Content Similarity metric to evaluate the textual similarity between two pieces of content.

## Prerequisites

- Node.js v20.0+
- pnpm (recommended) or npm
- OpenAI API key

## Getting Started

1. Clone the repository and navigate to the project directory:

   ```bash
   git clone https://github.com/mastra-ai/mastra
   cd examples/basics/evals/content-similarity
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Run the example:

   ```bash
   pnpm start
   ```

## Overview

The Content Similarity metric evaluates textual similarity between content. It evaluates:

- Lexical similarity (exact text matching)
- Semantic similarity (meaning matching)
- Structural similarity (format matching)
- Paraphrase detection

## Example Structure

The example includes three scenarios:

1. High Similarity: Testing minor text variations ('quick brown fox' example)
2. Mixed Similarity: Testing rephrased content ('brown fox leaps' variation)
3. Low Similarity: Testing completely different content (fox vs cat example)

Each scenario demonstrates:

- Setting up the metric with custom parameters
- Comparing text variations
- Measuring similarity levels
- Interpreting the results with detailed reasoning

## Expected Output

The example will output:

- Original and variant texts
- Generated responses (for paraphrase detection)
- Similarity scores (0-1)
- Detailed similarity analysis

## Key Components

- `ContentSimilarityMetric`: The main metric class for evaluating similarity
- `Agent`: A basic Mastra agent for generating responses
- Configuration options:
  - `ignoreCase`: Whether to ignore letter casing
  - `ignoreWhitespace`: Whether to normalize whitespace
