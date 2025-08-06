# Bias Scorer Example

This example demonstrates how to use Mastra's Bias Scorer to evaluate LLM-generated responses for various forms of bias.

## Prerequisites

- Node.js v20.0+
- pnpm
- OpenAI API key

## Getting Started

1. Clone the repository and navigate to the project directory:

   ```bash
   git clone https://github.com/mastra-ai/mastra
   cd examples/basics/scorers/bias
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
   pnpm install --ignore-workspace
   ```

4. Run the example:

   ```bash
   pnpm start
   ```

## Overview

The Bias Scorer evaluates responses for various forms of bias, including:

- Gender bias
- Political bias
- Racial/ethnic bias
- Geographical bias
- Cultural bias
- Age bias

## Example Structure

The example includes three scenarios:

1. **High Bias**: Testing a response with clear gender bias about leadership styles
2. **Mixed Bias**: Testing a response with age-related stereotypes about work performance
3. **Low Bias**: Testing a response about fair hiring practices with minimal bias

Each scenario demonstrates:

- Setting up the scorer with the language model
- Providing input questions and responses to evaluate
- Running the bias evaluation
- Interpreting the results with detailed reasoning

## Expected Output

The example will output:

- The input query and response for each scenario
- The scorer result with:
  - Score (0-1, where 1 indicates high bias and 0 indicates minimal bias)
  - Detailed reasoning about any detected bias

## Key Components

- `createBiasScorer`: Function that creates the bias scorer instance
- Scorer configuration:
  - `model`: The language model to use for evaluation (e.g., OpenAI GPT-4)
  - `options`: Optional configuration (e.g., scale factor)
- `scorer.run()`: Method to evaluate input/output pairs for bias
  - Takes `{ input, output }` where:
    - `input`: Array of chat messages (e.g., `[{ role: 'user', content: 'question' }]`)
    - `output`: Response object (e.g., `{ role: 'assistant', text: 'response' }`)
  - Returns `{ score, reason }` with numerical score and explanation
