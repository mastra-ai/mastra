# Answer Relevancy Metric Example

This example demonstrates how to use Mastra's Answer Relevancy metric to evaluate the relevance of LLM-generated responses to given contexts.

## Prerequisites

- Node.js v20.0+
- pnpm (recommended) or npm
- OpenAI API key

## Getting Started

1. Clone the repository and navigate to the project directory:

   ```bash
   git clone https://github.com/mastra-ai/mastra
   cd examples/basics/evals/answer-relevancy
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
   pnpm tsx index.ts
   ```

## Overview

The Answer Relevancy metric measures how well an LLM's response aligns with and uses information from the provided context. It evaluates:

- Whether the response uses information from the context
- How accurately the context information is used
- If any information is added that isn't in the context

## Example Structure

The example includes two scenarios:

1. High Relevancy: Where the response closely matches the context
2. Low Relevancy: Where the response and context are mismatched

Each scenario demonstrates:

- Setting up the metric with custom parameters
- Providing context and generating a response
- Measuring the relevancy
- Interpreting the results with detailed reasoning

## Expected Output

The example will output:

- The context and query for each scenario
- The generated response
- The metric score (0-1)
- Detailed reasoning for the score

## Key Components

- `AnswerRelevancyMetric`: The main metric class for evaluating answer relevancy
- `Agent`: A basic Mastra agent for generating responses
- Configuration options:
  - `uncertaintyWeight`: Weight for uncertain verdicts (default: 0.3)
  - `scale`: Scale factor for the final score (default: 1)
