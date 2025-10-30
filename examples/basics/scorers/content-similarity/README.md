# Content Similarity Scorer Example

This example demonstrates how to use Mastra's Content Similarity Scorer to evaluate the textual similarity between input and output content.

## Prerequisites

- Node.js v20.0+
- pnpm (recommended) or npm

## Getting Started

1. Clone the repository and navigate to the project directory:

   ```bash
   git clone https://github.com/mastra-ai/mastra
   cd examples/basics/scorers/content-similarity
   ```

2. Install dependencies:

   ```bash
   pnpm install --ignore-workspace
   ```

3. Run the example:

   ```bash
   pnpm start
   ```

## Overview

The Content Similarity Scorer evaluates textual similarity between input and output content using various similarity metrics. It measures:

- Lexical similarity (exact text matching)
- Semantic similarity (meaning-based comparison)
- Structural similarity (format and pattern matching)
- Content overlap and paraphrase detection

## Example Structure

The example includes three scenarios:

1. **High Similarity**: Testing minimal text variations (tense changes, articles)
2. **Moderate Similarity**: Testing rephrased content with similar meaning but different wording
3. **Low Similarity**: Testing completely different content with minimal overlap

Each scenario demonstrates:

- Setting up the scorer (no configuration needed)
- Providing input/output pairs for similarity analysis
- Running the similarity evaluation
- Interpreting the similarity scores and results

## Expected Output

The example will output:

- The input and output text for each scenario
- The scorer result with:
  - Score (0-1, where 1 indicates identical content)
  - Extract step results showing detailed similarity metrics

## Key Components

- `createContentSimilarityScorer`: Function that creates the content similarity scorer instance
- No configuration required - the scorer uses built-in similarity algorithms
- `scorer.run()`: Method to evaluate input/output pairs for content similarity
  - Takes `{ input, output }` where:
    - `input`: Array of chat messages (e.g., `[{ role: 'user', content: 'text' }]`)
    - `output`: Response object (e.g., `{ role: 'assistant', text: 'response' }`)
  - Returns results with:
    - `score`: Numerical similarity score (0-1)
