# Contextual Recall Example

This example demonstrates how to use the Contextual Recall metric to evaluate how well a response recalls and uses provided context information.

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

1. High Recall: Using context about the Great Wall of China

   - Shows how well the model recalls comprehensive historical information
   - Demonstrates proper integration of multiple context points

2. Partial Recall: Using context about DNA structure and function
   - Shows how the model handles complex scientific information
   - Demonstrates recall of technical details and concepts

## Understanding the Results

The metric provides:

- A score between 0 and 1 indicating recall effectiveness
- Detailed reasoning about what information was recalled
- Analysis of how completely the context was used

## Additional Resources

For more information, check out:

- [Contextual Recall Documentation](https://mastra.ai/docs/examples/evals/contextual-recall)
- [Mastra Evals Documentation](https://mastra.ai/docs/examples/evals)
