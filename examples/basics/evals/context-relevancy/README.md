# Context Relevancy Example

This example demonstrates how to use the Context Relevancy metric to evaluate how well a response uses relevant context information.

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

1. High Relevancy: Using context about photosynthesis to answer a question about oxygen production

   - Shows how well the model uses highly relevant context
   - Demonstrates proper context selection for the query

2. Mixed Relevancy: Using context about brain function to answer a specific question about visual processing
   - Shows how the model handles mixed relevancy context
   - Demonstrates context filtering and selection

## Understanding the Results

The metric provides:

- A score between 0 and 1 indicating context relevancy
- Detailed reasoning about which context was relevant and why
- Analysis of how well the response used the relevant context

## Additional Resources

For more information, check out:

- [Context Relevancy Documentation](https://mastra.ai/docs/examples/evals/context-relevancy)
- [Mastra Evals Documentation](https://mastra.ai/docs/examples/evals)
