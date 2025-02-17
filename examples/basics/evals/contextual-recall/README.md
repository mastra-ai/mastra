# Contextual Recall Metric Example

This example demonstrates how to use Mastra's Contextual Recall metric to evaluate how well responses recall and use provided context information.

## Prerequisites

- Node.js v20.0+
- pnpm (recommended) or npm
- OpenAI API key

## Getting Started

1. Clone the repository and navigate to the project directory:

   ```bash
   git clone https://github.com/mastra-ai/mastra
   cd examples/basics/evals/contextual-recall
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

The Contextual Recall metric evaluates how well responses recall and use provided context information. It evaluates:

- Completeness of context recall
- Accuracy of recalled information
- Integration of context elements
- Information preservation

## Example Structure

The example includes three scenarios:

1. High Recall: Testing product features (all context recalled)
2. Mixed Recall: Testing Python characteristics (partial context recall)
3. Low Recall: Testing weather patterns (minimal context recall)

Each scenario demonstrates:

- Setting up the metric with context
- Generating responses to evaluate
- Measuring recall completeness
- Interpreting the results with detailed reasoning

## Expected Output

The example will output:

- The context and query for each scenario
- The generated response
- The metric score (0-1)
- Detailed reasoning for the score

## Key Components

- `ContextualRecallMetric`: The main metric class for evaluating recall
- Configuration options:
  - `context`: Array of context strings
  - `scale`: Scale factor for the final score (default: 1)
