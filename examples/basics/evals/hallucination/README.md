# Hallucination Metric Example

This example demonstrates how to use Mastra's Hallucination metric to evaluate whether responses contain information not supported by the provided context.

## Prerequisites

- Node.js v20.0+
- pnpm (recommended) or npm
- OpenAI API key

## Getting Started

1. Clone the repository and navigate to the project directory:

   ```bash
   git clone https://github.com/mastra-ai/mastra
   cd examples/basics/evals/hallucination
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

The Hallucination metric evaluates whether responses contain information not supported by the provided context. It evaluates:

- Whether the response adds unsupported information
- How accurately the context information is used
- The degree of factual deviation from the context

## Example Structure

The example includes three scenarios:

1. No Hallucination: Testing iPhone release details
2. Mixed Hallucination: Testing Star Wars movie facts
3. High Hallucination: Testing scientific concepts

Each scenario demonstrates:

- Setting up the metric with context
- Generating a response to evaluate
- Measuring hallucination levels
- Interpreting the results with detailed reasoning

## Expected Output

The example will output:

- The context and query for each scenario
- The generated response
- The metric score (0-1)
- Detailed reasoning for the score

## Key Components

- `HallucinationMetric`: The main metric class for evaluating hallucination
- Configuration options:
  - `context`: Array of context strings
  - `scale`: Scale factor for the final score (default: 1)
