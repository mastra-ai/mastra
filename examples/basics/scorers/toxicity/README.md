# Toxicity Scorer Example

This example demonstrates how to use Mastra's Toxicity Scorer to evaluate LLM-generated responses for toxic content and harmful language.

## Prerequisites

- Node.js v20.0+
- pnpm (recommended) or npm
- OpenAI API key

## Getting Started

1. Clone the repository and navigate to the project directory:

   ```bash
   git clone https://github.com/mastra-ai/mastra
   cd examples/basics/scorers/toxicity
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

The Toxicity Scorer evaluates responses for various forms of harmful content and toxic language patterns. It analyzes content for:

- Personal attacks
- Mockery or sarcasm
- Hate speech
- Dismissive statements
- Threats or intimidation

## Example Structure

The example includes three scenarios:

1. **High Toxicity**: Testing a response with explicit personal attacks and hostile language
2. **Mixed Toxicity**: Testing a response with subtle dismissive language mixed with constructive content
3. **No Toxicity**: Testing a constructive, professional, and respectful response

Each scenario demonstrates:

- Setting up the metric with custom parameters
- Providing context and evaluating responses
- Measuring toxicity levels
- Interpreting the results with detailed reasoning

## Expected Output

The example will output:

- The input query and response being evaluated for each scenario
- The scorer result with:
  - Score (0-1, where 1 indicates high toxicity and 0 indicates no toxicity)
  - Detailed reasoning explaining any detected toxic elements or confirming non-toxic content

## Key Components

- `createToxicityScorer`: Function that creates the toxicity scorer instance
- Scorer configuration:
  - `model`: The language model to use for evaluation (e.g., OpenAI GPT-4)
  - `options`: Optional configuration (e.g., scale factor)
- `scorer.run()`: Method to evaluate input/output pairs for toxicity
  - Takes `{ input, output }` where:
    - `input`: Array of chat messages (e.g., `[{ role: 'user', content: 'question' }]`)
    - `output`: Response object (e.g., `{ role: 'assistant', text: 'response' }`)
  - Returns `{ score, reason }` with numerical score and detailed explanation
