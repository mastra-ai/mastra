# Textual Difference Metric Example

This example demonstrates how to use Mastra's Textual Difference metric to evaluate the similarity between text strings by analyzing sequence differences and changes.

## Prerequisites

- Node.js v20.0+
- pnpm (recommended) or npm

## Getting Started

1. Clone the repository and navigate to the project directory:

   ```bash
   git clone https://github.com/mastra-ai/mastra
   cd examples/basics/evals/textual-difference
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

The Textual Difference metric evaluates text similarity by analyzing:

- Sequence matching between texts
- Number of change operations needed
- Length differences between texts
- Confidence based on text variations

## Example Structure

The example includes three scenarios:

1. Identical Texts: Testing perfect matches

   - Same text in both input and output
   - Demonstrates maximum similarity score

2. Minor Differences: Testing small variations

   - Few word changes between texts
   - Shows how small edits affect the score

3. Major Differences: Testing significant changes
   - Completely different content
   - Demonstrates minimum similarity score

Each scenario demonstrates:

- Setting up the metric
- Comparing input and output texts
- Measuring textual differences
- Analyzing detailed metrics:
  - Confidence score
  - Similarity ratio
  - Change operations count
  - Length difference

## Expected Output

The example will output:

- The input and output texts being compared
- The similarity score (0-1)
- Detailed metrics including:
  - Confidence: How reliable the comparison is
  - Ratio: Raw similarity score
  - Changes: Number of edit operations
  - Length Difference: Text size variation

## Key Components

- `TextualDifferenceMetric`: The main metric class for evaluating text differences
- Sequence matching features:
  - Character-level comparison
  - Edit distance calculation
  - Length normalization
  - Confidence scoring
