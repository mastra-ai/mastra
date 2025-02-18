# Tone Consistency Metric Example

This example demonstrates how to use Mastra's Tone Consistency metric to evaluate emotional tone patterns and sentiment consistency in text.

## Prerequisites

- Node.js v20.0+
- pnpm (recommended) or npm

## Getting Started

1. Clone the repository and navigate to the project directory:

   ```bash
   git clone https://github.com/mastra-ai/mastra
   cd examples/basics/evals/tone-consistency
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

The Tone Consistency metric evaluates text in two modes:

1. Comparison Mode:

   - Compares tone between input and output texts
   - Measures sentiment alignment
   - Identifies tone shifts

2. Stability Mode:
   - Analyzes tone patterns within a single text
   - Measures sentiment variance
   - Evaluates emotional consistency

## Example Structure

The example includes three scenarios:

1. Consistent Positive Tone: Testing tone matching

   - Similar positive sentiment in both texts
   - Demonstrates high consistency score

2. Tone Stability: Testing single text analysis

   - Multiple sentences with consistent tone
   - Shows internal tone stability

3. Mixed Tone: Testing tone differences
   - Contrasting sentiments between texts
   - Demonstrates low consistency score

Each scenario demonstrates:

- Setting up the metric
- Analyzing tone patterns
- Measuring sentiment consistency
- Evaluating detailed metrics:
  - Sentiment scores
  - Tone differences
  - Stability measures

## Expected Output

The example will output:

- The input and output texts being analyzed
- The consistency/stability score (0-1)
- Detailed metrics including:
  - For comparison mode:
    - Response sentiment
    - Reference sentiment
    - Sentiment difference
  - For stability mode:
    - Average sentiment
    - Sentiment variance

## Key Components

- `ToneConsistencyMetric`: The main metric class for evaluating tone patterns
- Sentiment analysis features:
  - Emotional tone detection
  - Sentiment scoring
  - Variance calculation
  - Multi-sentence analysis
