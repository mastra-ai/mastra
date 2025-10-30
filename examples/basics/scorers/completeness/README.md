# Completeness Scorer Example

This example demonstrates how to use Mastra's Completeness Scorer to evaluate how thoroughly LLM-generated responses cover key elements from the input.

## Prerequisites

- Node.js v20.0+
- pnpm (recommended) or npm

## Getting Started

1. Clone the repository and navigate to the project directory:

   ```bash
   git clone https://github.com/mastra-ai/mastra
   cd examples/basics/scorers/completeness
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

The Completeness Scorer evaluates how thoroughly responses cover key elements from the input. It uses NLP analysis to extract and compare elements, evaluating:

- Coverage of important elements (nouns, verbs, topics, terms)
- Presence of required information from the input
- Missing or incomplete elements
- Element count and distribution analysis

The scorer uses the `compromise` NLP library to extract meaningful elements and calculates coverage percentage based on how many input elements are present in the output.

## Example Structure

The example includes three scenarios:

1. **Complete Coverage**: Testing when output perfectly matches input elements (primary colors)
2. **Partial Coverage**: Testing when output covers some but not all input elements
3. **Minimal Coverage**: Testing when output covers very few input elements (seasons)

Each scenario demonstrates:

- Setting up the scorer (no configuration needed)
- Providing input/output pairs for evaluation
- Running the completeness analysis
- Interpreting the results with missing elements and element counts

## Expected Output

The example will output:

- The input and output text for each scenario
- The scorer result with:
  - Score (0-1, where 1 indicates complete coverage)
  - Extract step results showing:
    - Missing elements from the input
    - Element counts (input vs output)

## Key Components

- `createCompletenessScorer`: Function that creates the completeness scorer instance
- No configuration required - the scorer uses built-in NLP analysis
- `scorer.run()`: Method to evaluate input/output pairs for completeness
  - Takes `{ input, output }` where:
    - `input`: Array of chat messages (e.g., `[{ role: 'user', content: 'text' }]`)
    - `output`: Response object (e.g., `{ role: 'assistant', text: 'response' }`)
  - Returns results with:
    - `score`: Numerical score (0-1)
    - `extractStepResult`: Detailed analysis including missing elements and counts
