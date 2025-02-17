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

The Context Position metric evaluates:

- Sequential ordering of information
- Temporal consistency
- Logical flow of context usage
- Position-aware context integration

## Example Structure

The example includes two scenarios:

1. Sequential Context: Testing chronological historical events
2. Non-sequential Context: Testing topic-based information

Each scenario demonstrates:

- Setting up the metric with context arrays
- Generating responses with ordered information
- Measuring position adherence
- Analyzing the results

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
