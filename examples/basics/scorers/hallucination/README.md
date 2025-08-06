# Hallucination Scorer Example

This example demonstrates how to use Mastra's Hallucination Scorer to evaluate whether responses contain information not supported by the provided context.

## Prerequisites

- Node.js v20.0+
- pnpm (recommended) or npm
- OpenAI API key

## Getting Started

1. Clone the repository and navigate to the project directory:

   ```bash
   git clone https://github.com/mastra-ai/mastra
   cd examples/basics/scorers/hallucination
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

The Hallucination Scorer evaluates whether responses contain information not supported by the provided context. It analyzes responses to detect:

- Whether the response adds unsupported or fabricated information
- How accurately the context information is used
- The degree of factual deviation from the provided context
- Claims that contradict or go beyond the available context

## Example Structure

The example includes three scenarios:

1. **No Hallucination**: Testing iPhone release details where the response accurately reflects the context
2. **Mixed Hallucination**: Testing Star Wars movie facts where some information is correct and some is fabricated
3. **Complete Hallucination**: Testing Wright brothers flight details where the response contains entirely incorrect information

Each scenario demonstrates:

- Setting up the scorer with the language model
- Providing context arrays as the source of truth
- Running hallucination detection analysis
- Interpreting the results with detailed reasoning about detected hallucinations

## Expected Output

The example will output:

- The provided context, input query, and response for each scenario
- The scorer result with:
  - Score (0-1, where 1 indicates high hallucination and 0 indicates no hallucination)
  - Detailed reasoning explaining which parts of the response are supported or unsupported by context

## Key Components

- `createHallucinationScorer`: Function that creates the hallucination scorer instance
- Scorer configuration:
  - `model`: The language model to use for evaluation (e.g., OpenAI GPT-4)
- `scorer.run()`: Method to evaluate input/output pairs for hallucinations
  - Takes `{ input, output, additionalContext }` where:
    - `input`: Array of chat messages (e.g., `[{ role: 'user', content: 'question' }]`)
    - `output`: Response object (e.g., `{ role: 'assistant', text: 'response' }`)
    - `additionalContext`: Object with `context` array containing the source material
  - Returns `{ score, reason }` with numerical score and detailed explanation
