# Context Precision Metric Example

This example demonstrates how to use Mastra's Context Precision metric to evaluate how accurately responses use provided context information.

## Prerequisites

- Node.js v20.0+
- pnpm (recommended) or npm
- OpenAI API key

## Getting Started

1. Clone the repository and navigate to the project directory:

   ```bash
   git clone https://github.com/mastra-ai/mastra
   cd examples/basics/evals/context-precision
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

The Context Precision metric evaluates:

- Accuracy of context usage
- Relevance to the query
- Information fidelity
- Context integration quality

## Example Structure

The example includes two scenarios:

1. High Precision: Testing specific scientific information
2. Mixed Precision: Testing broader topic information

Each scenario demonstrates:

- Setting up the metric with context arrays
- Generating responses with context
- Measuring precision of usage
- Analyzing the results

## Expected Output

The example will output:

- Context arrays and queries
- Generated responses
- Precision scores (0-1)
- Detailed reasoning about precision

## Key Components

- `ContextPrecisionMetric`: The main metric class for evaluating precision
- `Agent`: A basic Mastra agent for generating responses
- Configuration options:
  - `scale`: Scale factor for the final score
  - `context`: Array of context pieces to evaluate against
