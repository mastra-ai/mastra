# Faithfulness Scorer Example

This example demonstrates how to use Mastra's Faithfulness Scorer to evaluate how accurately responses adhere to the provided context without introducing unsupported information.

## Prerequisites

- Node.js v20.0+
- pnpm (recommended) or npm
- OpenAI API key

## Getting Started

1. Clone the repository and navigate to the project directory:

   ```bash
   git clone https://github.com/mastra-ai/mastra
   cd examples/basics/scorers/faithfulness
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

The Faithfulness Scorer evaluates how accurately responses adhere to provided context without introducing unsupported claims. It analyzes:

- Factual accuracy of claims against provided context
- Detection of unsupported or fabricated information (hallucinations)
- Context adherence and reliability
- Verification of all response claims against source material

## Example Structure

The example includes three scenarios:

1. **High Faithfulness**: Testing Tesla Model 3 facts where all response claims are supported by context
2. **Mixed Faithfulness**: Testing Python programming language where some claims are supported and others are not
3. **Low Faithfulness**: Testing Mars information where response claims contradict the provided context

Each scenario demonstrates:

- Setting up the scorer with specific context and model configuration
- Providing context arrays for fact verification
- Running faithfulness evaluation on responses
- Interpreting the results with detailed reasoning about claim support

## Expected Output

The example will output:

- The provided context, input query, and response for each scenario
- The scorer result with:
  - Score (0-1, where 1 indicates perfect faithfulness to context)
  - Detailed reasoning explaining which claims are supported or unsupported

## Key Components

- `createFaithfulnessScorer`: Function that creates the faithfulness scorer instance
- Scorer configuration:
  - `model`: The language model to use for evaluation (e.g., OpenAI GPT-4)
  - `options.context`: Array of context strings that serve as the source of truth
  - `options.scale`: Optional scale factor for the final score (default: 1)
- `scorer.run()`: Method to evaluate input/output pairs for faithfulness
  - Takes `{ input, output }` where:
    - `input`: Array of chat messages (e.g., `[{ role: 'user', content: 'question' }]`)
    - `output`: Response object (e.g., `{ role: 'assistant', text: 'response' }`)
  - Returns `{ score, reason }` with numerical score and detailed explanation
