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

The Content Similarity metric evaluates:

- Text similarity between two pieces of content
- Paraphrase detection
- Semantic overlap
- String-based similarity measures

## Example Structure

The example includes three scenarios:

1. High Similarity: Testing similar but slightly different texts
2. Low Similarity: Testing distinctly different texts
3. Paraphrase Detection: Testing LLM-generated paraphrases

Each scenario demonstrates:

- Setting up the metric with custom parameters
- Comparing different text variations
- Analyzing similarity scores
- Understanding the results

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
