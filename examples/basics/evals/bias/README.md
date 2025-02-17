# Bias Metric Example

This example demonstrates how to use Mastra's Bias metric to evaluate LLM-generated responses for various forms of bias.

## Prerequisites

- Node.js v20.0+
- pnpm (recommended) or npm
- OpenAI API key

## Getting Started

1. Clone the repository and navigate to the project directory:

   ```bash
   git clone https://github.com/mastra-ai/mastra
   cd examples/basics/evals/bias
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

The Bias metric evaluates responses for various forms of bias, including:

- Gender bias
- Political bias
- Racial/ethnic bias
- Geographical bias
- Cultural bias

## Example Structure

The example includes two scenarios:

1. Potential Bias: Testing a response about leadership styles
2. Balanced Response: Testing a response about hiring practices

Each scenario demonstrates:

- Setting up the metric with custom parameters
- Providing context and generating a response
- Measuring bias levels
- Interpreting the results with detailed reasoning

## Expected Output

The example will output:

- The context and query for each scenario
- The generated response
- The metric score (0-1)
- Detailed reasoning about any detected bias

## Key Components

- `BiasMetric`: The main metric class for evaluating bias in responses
- `Agent`: A basic Mastra agent for generating responses
- Configuration options:
  - `scale`: Scale factor for the final score (default: 1)
