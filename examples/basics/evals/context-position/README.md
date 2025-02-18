# Context Position Metric Example

This example demonstrates how to use Mastra's Context Position metric to evaluate how well responses maintain the sequential order of context information.

## Prerequisites

- Node.js v20.0+
- pnpm (recommended) or npm
- OpenAI API key

## Getting Started

1. Clone the repository and navigate to the project directory:

   ```bash
   git clone https://github.com/mastra-ai/mastra
   cd examples/basics/evals/context-position
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

The Context Position metric evaluates how well responses maintain the sequential order of context information. It evaluates:

- Position of information in context
- Order of information in response
- Relevance to query position
- Information flow and structure

## Example Structure

The example includes three scenarios:

1. High Position: Testing capital of France (using first context item)
2. Mixed Position: Testing elephant facts (using scattered context)
3. Low Position: Testing historical events (using reversed context)

Each scenario demonstrates:

- Setting up the metric with ordered context
- Generating responses to evaluate
- Measuring position adherence
- Interpreting the results with detailed reasoning

## Expected Output

The example will output:

- Context arrays and queries
- Generated responses
- Position scores (0-1)
- Detailed reasoning about position adherence

## Key Components

- `ContextPositionMetric`: The main metric class for evaluating position
- `Agent`: A basic Mastra agent for generating responses
- Configuration options:
  - `scale`: Scale factor for the final score
  - `context`: Array of context pieces in order
