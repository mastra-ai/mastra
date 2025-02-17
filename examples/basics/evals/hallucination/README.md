# Hallucination Example

This example demonstrates how to use the Hallucination metric to evaluate whether responses contain information not supported by the provided context.

## Prerequisites

1. OpenAI API key
2. Node.js and pnpm installed

## Getting Started

1. Copy `.env.example` to `.env` and add your OpenAI API key:

   ```bash
   cp .env.example .env
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Run the example:
   ```bash
   pnpm start
   ```

## What to Expect

The example demonstrates two scenarios:

1. Low Hallucination: Using well-defined historical facts about the Eiffel Tower

   - Shows how the model stays within provided context
   - Demonstrates accurate fact adherence

2. High Hallucination Risk: Using complex quantum computing concepts
   - Shows how the model handles technical topics
   - Demonstrates hallucination detection in complex scenarios

## Understanding the Results

The metric provides:

- A score between 0 and 1 indicating hallucination level
- Detailed reasoning about unsupported claims
- Analysis of factual accuracy

## Additional Resources

For more information, check out:

- [Hallucination Documentation](https://mastra.ai/docs/examples/evals/hallucination)
- [Mastra Evals Documentation](https://mastra.ai/docs/examples/evals)
