# Keyword Coverage Metric Example

This example demonstrates how to use Mastra's Keyword Coverage metric to evaluate how well responses cover important keywords from the input text.

## Prerequisites

- Node.js v20.0+
- pnpm (recommended) or npm

## Getting Started

1. Clone the repository and navigate to the project directory:

   ```bash
   git clone https://github.com/mastra-ai/mastra
   cd examples/basics/evals/keyword-coverage
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

The Keyword Coverage metric evaluates how well responses include important keywords from the input. It analyzes:

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

- The input text with keywords to match
- The output text being evaluated
- The coverage score (0-1)
- Detailed statistics about matched keywords

## Key Components

- `KeywordCoverageMetric`: The main metric class for evaluating keyword coverage
- Keyword analysis features:
  - Stop word filtering
  - Case normalization
  - Technical term handling
  - Compound word support
