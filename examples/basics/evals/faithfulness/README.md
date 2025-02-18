# Faithfulness Metric Example

This example demonstrates how to use Mastra's Faithfulness metric to evaluate how accurately responses adhere to the provided context without introducing unsupported information.

## Prerequisites

- Node.js v20.0+
- pnpm (recommended) or npm
- OpenAI API key

## Getting Started

1. Clone the repository and navigate to the project directory:

   ```bash
   git clone https://github.com/mastra-ai/mastra
   cd examples/basics/evals/faithfulness
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

The Faithfulness metric evaluates how accurately responses adhere to provided context. It evaluates:

- Factual accuracy of claims
- Presence of unsupported information
- Context adherence
- Information reliability

## Example Structure

The example includes three scenarios:

1. High Faithfulness: Testing Tesla Model 3 facts (all claims supported)
2. Mixed Faithfulness: Testing Python history (some unsupported claims)
3. Low Faithfulness: Testing technology trends (mostly unsupported claims)

Each scenario demonstrates:

- Setting up the metric with factual context
- Generating responses to evaluate
- Measuring claim faithfulness
- Interpreting the results with detailed reasoning

## Expected Output

The example will output:

- The context and query for each scenario
- The generated response
- The metric score (0-1)
- Detailed reasoning for the score

## Key Components

- `FaithfulnessMetric`: The main metric class for evaluating faithfulness
- Configuration options:
  - `context`: Array of context strings
  - `scale`: Scale factor for the final score (default: 1)
