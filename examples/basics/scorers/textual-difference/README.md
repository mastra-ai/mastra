# Textual Difference Scorer Example

This example demonstrates how to use Mastra's Textual Difference Scorer to evaluate the similarity between input and output text strings by analyzing sequence differences and changes.

## Prerequisites

- Node.js v20.0+
- pnpm (recommended) or npm

## Getting Started

1. Clone the repository and navigate to the project directory:

   ```bash
   git clone https://github.com/mastra-ai/mastra
   cd examples/basics/scorers/textual-difference
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

The Textual Difference metric evaluates text similarity by analyzing:

- Sequence matching between input and output texts
- Number of change operations needed to transform one text into another
- Length differences between texts
- Similarity ratios and confidence scores based on text variations

The scorer uses algorithms to compare texts at the character and word level, providing detailed analysis of differences.

## Example Structure

The example includes three scenarios:

1. **Identical Texts**: Testing perfect matches where input and output are exactly the same
2. **Minor Differences**: Testing small variations with few word changes between texts
3. **Major Differences**: Testing significant changes with completely different content

Each scenario demonstrates:

- Setting up the scorer (no configuration needed)
- Providing input and output text pairs for comparison
- Running textual difference analysis
- Interpreting detailed similarity metrics and change analysis

## Expected Output

The example will output:

- The input and output texts being compared
- The scorer result with:
  - Score (0-1, where 1 indicates identical texts)
  - Analyze step results showing detailed metrics including:
    - Confidence: How reliable the comparison is
    - Similarity ratio: Raw similarity score
    - Change operations: Number of edit operations needed
    - Length difference: Text size variation

## Key Components

- `createTextualDifferenceScorer`: Function that creates the textual difference scorer instance
- No configuration required - the scorer uses built-in sequence matching algorithms
- `scorer.run()`: Method to evaluate input/output pairs for textual differences
  - Takes `{ input, output }` where:
    - `input`: Array of chat messages (e.g., `[{ role: 'user', content: 'text' }]`)
    - `output`: Response object (e.g., `{ role: 'assistant', text: 'response' }`)
  - Returns results with:
    - `score`: Numerical similarity score (0-1)
    - `analyzeStepResult`: Detailed difference analysis including confidence, ratio, and change metrics
