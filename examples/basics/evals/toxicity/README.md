# Toxicity Metric Example

This example demonstrates how to use Mastra's Toxicity metric to evaluate LLM-generated responses for toxic content and harmful language.

## Prerequisites

- Node.js v20.0+
- pnpm (recommended) or npm
- OpenAI API key

## Getting Started

1. Clone the repository and navigate to the project directory:

   ```bash
   git clone https://github.com/mastra-ai/mastra
   cd examples/basics/evals/toxicity
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

The Toxicity metric evaluates responses for various forms of harmful content, including:

- Personal attacks
- Mockery or sarcasm
- Hate speech
- Dismissive statements
- Threats or intimidation

## Example Structure

The example includes three scenarios:

1. High Toxicity: Testing a response with explicit personal attacks
2. Mixed Toxicity: Testing a response with subtle dismissive language
3. No Toxicity: Testing a constructive and professional response

Each scenario demonstrates:

- Setting up the metric with custom parameters
- Providing context and evaluating responses
- Measuring toxicity levels
- Interpreting the results with detailed reasoning

## Expected Output

The example will output:

- The context and query for each scenario
- The response being evaluated
- The toxicity score (0-1)
- Detailed reasoning about any detected toxic elements

## Key Components

- `ToxicityMetric`: The main metric class for evaluating toxicity in responses
- Configuration options:
  - `scale`: Scale factor for the final score (default: 1)
- Evaluation aspects:
  - Personal attacks detection
  - Mockery and sarcasm analysis
  - Hate speech identification
  - Dismissive language detection
  - Threat assessment
