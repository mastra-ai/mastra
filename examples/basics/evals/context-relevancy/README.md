# Context Relevancy Metric Example

This example demonstrates how to use Mastra's Context Relevancy metric to evaluate how well responses use relevant context information.

## Prerequisites

- Node.js v20.0+
- pnpm (recommended) or npm
- OpenAI API key

## Getting Started

1. Clone the repository and navigate to the project directory:

   ```bash
   git clone https://github.com/mastra-ai/mastra
   cd examples/basics/evals/context-relevancy
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

The Context Relevancy metric evaluates how well responses use relevant context information. It evaluates:

- Relevance of context to query
- Context selection and usage
- Information accuracy
- Response completeness

## Example Structure

The example includes three scenarios:

1. High Relevancy: Testing Einstein's achievements (all context relevant)
2. Mixed Relevancy: Testing solar eclipses (some irrelevant context)
3. Low Relevancy: Testing weather patterns (mostly irrelevant context)

Each scenario demonstrates:

- Setting up the metric with varied context
- Generating responses to evaluate
- Measuring context relevancy
- Interpreting the results with detailed reasoning

## Expected Output

The example will output:

- The context and query for each scenario
- The generated response
- The metric score (0-1)
- Detailed reasoning for the score

## Key Components

- `ContextRelevancyMetric`: The main metric class for evaluating context relevancy
- Configuration options:
  - `context`: Array of context strings
  - `scale`: Scale factor for the final score (default: 1)
