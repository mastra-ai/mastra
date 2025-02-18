# Custom Eval Metric Example

This example demonstrates how to create custom evaluation metrics in Mastra, from simple string matching to LLM-based evaluation.

## Prerequisites

- Node.js v20.0+
- pnpm (recommended) or npm
- OpenAI API key (for LLM-based metric)

## Getting Started

1. Clone the repository and navigate to the project directory:

   ```bash
   git clone https://github.com/mastra-ai/mastra
   cd examples/basics/evals/custom-eval
   ```

2. Copy the environment variables file and add your OpenAI API key:

   ```bash
   cp .env.example .env
   ```

   Then edit `.env` and add your OpenAI API key:

   ```env
   OPENAI_API_KEY=sk-your-api-key-here
   ```

3. Install dependencies:

   ```bash
   pnpm install
   ```

4. Run the example:

   ```bash
   pnpm start
   ```

## Overview

This example demonstrates how to create custom evaluation metrics. It evaluates:

- Custom metric implementation
- Integration with Mastra's core
- Metric result formatting
- LLM-based evaluation

## Example Structure

The example includes three scenarios:

1. Simple Metric: Testing keyword matching (basic string comparison)
2. Complex Metric: Testing dietary preferences (LLM-based analysis)
3. Mixed Case: Testing compliant recipe (edge case handling)

Each scenario demonstrates:

- Setting up custom metric classes
- Implementing measure() method
- Handling different input types
- Interpreting the results with detailed reasoning

## Expected Output

The example will output:

- The input and output for each scenario
- The metric score (0-1)
- Detailed analysis results
- Custom metric-specific information

## Key Components

- `KeywordMatchMetric`: Simple string-based metric example
- `DietaryPreferencesMetric`: Complex LLM-based metric example
- Configuration options vary by metric type
