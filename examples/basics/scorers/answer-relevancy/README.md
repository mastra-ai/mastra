# Answer Relevancy Scorer Example

This example demonstrates how to use Mastra's Answer Relevancy Scorer to evaluate the relevance of LLM-generated responses to given inputs.

## Prerequisites

- Node.js v20.0+
- pnpm
- OpenAI API key

## Getting Started

1. Clone the repository and navigate to the project directory:

   ```bash
   git clone https://github.com/mastra-ai/mastra
   cd examples/basics/scorers/answer-relevancy
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

The Answer Relevancy Scorer measures how well an LLM's response aligns with and addresses the given input question. It evaluates:

- Whether the response directly answers the input question
- How accurately the response addresses what was asked
- If any information is included that doesn't relate to the input

## Example Structure

The example includes three scenarios:

1. **High Relevancy**: Where the response directly and completely answers the question
2. **Partial Relevancy**: Where the response partially addresses the question with some additional context
3. **Low Relevancy**: Where the response is completely unrelated to the question

Each scenario demonstrates:

- Setting up the scorer with custom parameters
- Providing input questions and generating responses
- Running the scorer evaluation
- Interpreting the results with detailed reasoning

## Expected Output

The example will output:

- The input query and generated response for each scenario
- The scorer result with:
  - Score (0-1, where 1 is perfectly relevant)
  - Detailed reasoning for the score

## Key Components

- `createAnswerRelevancyScorer`: Function that creates the scorer instance
- Scorer configuration options:
  - `model`: The language model to use for evaluation (e.g., OpenAI GPT-4)
  - `options.uncertaintyWeight`: Weight for uncertain verdicts (default: 0.3)
  - `options.scale`: Scale factor for the final score (default: 1)
- `scorer.run()`: Method to evaluate input/output pairs
  - Takes `{ input, output }` where:
    - `input`: Array of chat messages (e.g., `[{ role: 'user', content: 'question' }]`)
    - `output`: Response object (e.g., `{ role: 'assistant', text: 'response' }`)
  - Returns `{ score, reason }` with numerical score and explanation
