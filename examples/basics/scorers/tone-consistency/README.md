# Tone Consistency Scorer Example

This example demonstrates how to use Mastra's Tone Scorer to evaluate emotional tone patterns and sentiment consistency between input and output text.

## Prerequisites

- Node.js v20.0+
- pnpm (recommended) or npm

## Getting Started

1. Clone the repository and navigate to the project directory:

   ```bash
   git clone https://github.com/mastra-ai/mastra
   cd examples/basics/scorers/tone-consistency
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

The Tone Scorer evaluates emotional tone and sentiment consistency in text by analyzing sentiment patterns and emotional alignment. It operates in different modes:

1. **Comparison Mode**: Compares tone between input and output texts, measuring sentiment alignment and identifying tone shifts
2. **Stability Mode**: Analyzes tone patterns within text, measuring sentiment variance and evaluating emotional consistency

The scorer uses sentiment analysis algorithms to detect emotional tone and calculate consistency scores.

## Example Structure

The example includes three scenarios:

1. **Consistent Positive Tone**: Testing tone matching between positive input and output texts
2. **Tone Stability**: Testing single text analysis with empty output to analyze input tone stability
3. **Mixed Tone**: Testing tone differences with contrasting sentiments between input and output

Each scenario demonstrates:

- Setting up the scorer (no configuration needed)
- Providing input and output text pairs for tone analysis
- Running tone consistency evaluation
- Interpreting detailed sentiment metrics and tone analysis

## Expected Output

The example will output:

- The input and output texts being analyzed
- The scorer result with:
  - Score (0-1, where 1 indicates perfect tone consistency)
  - Analyze step results showing detailed metrics including:
    - Sentiment scores for input and output
    - Tone differences and variations
    - Stability measures and consistency analysis

## Key Components

- `createToneScorer`: Function that creates the tone scorer instance
- No configuration required - the scorer uses built-in sentiment analysis algorithms
- `scorer.run()`: Method to evaluate input/output pairs for tone consistency
  - Takes `{ input, output }` where:
    - `input`: Array of chat messages (e.g., `[{ role: 'user', content: 'text' }]`)
    - `output`: Response object (e.g., `{ role: 'assistant', text: 'response' }`)
  - Returns results with:
    - `score`: Numerical consistency score (0-1)
    - `analyzeStepResult`: Detailed tone analysis including sentiment scores and consistency metrics
