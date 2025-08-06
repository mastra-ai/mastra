# Keyword Coverage Scorer Example

This example demonstrates how to use Mastra's Keyword Coverage Scorer to evaluate how well responses cover important keywords from the input text.

## Prerequisites

- Node.js v20.0+
- pnpm (recommended) or npm

## Getting Started

1. Clone the repository and navigate to the project directory:

   ```bash
   git clone https://github.com/mastra-ai/mastra
   cd examples/basics/scorers/keyword-coverage
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

The Keyword Coverage Scorer evaluates how well responses include important keywords and terms from the input text. It analyzes:

- Presence of key terms and concepts
- Coverage of technical terminology
- Matching of important phrases
- Handling of compound terms
- Case-insensitive matching

## Example Structure

The example includes three scenarios:

1. Full Coverage: Testing complete keyword matching
2. Partial Coverage: Testing partial keyword presence
3. Minimal Coverage: Testing limited keyword inclusion

Each scenario demonstrates:

- Setting up the metric
- Providing input and output text
- Measuring keyword coverage
- Analyzing match statistics

## Expected Output

The example will output:

- The input text containing keywords to match
- The output text being evaluated for keyword presence
- The scorer result with:
  - Score (0-1, where 1 indicates perfect keyword coverage)
  - Analyze step results showing detailed keyword matching statistics

## Key Components

- `createKeywordCoverageScorer`: Function that creates the keyword coverage scorer instance
- No configuration required - the scorer uses built-in keyword extraction and matching
- `scorer.run()`: Method to evaluate input/output pairs for keyword coverage
  - Takes `{ input, output }` where:
    - `input`: Array of chat messages (e.g., `[{ role: 'user', content: 'text' }]`)
    - `output`: Response object (e.g., `{ role: 'assistant', text: 'response' }`)
  - Returns results with:
    - `score`: Numerical coverage score (0-1)
    - `analyzeStepResult`: Detailed keyword matching analysis and statistics
