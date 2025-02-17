# Faithfulness Example

This example demonstrates how to use the Faithfulness metric to evaluate how accurately a response adheres to the provided context without introducing unsupported information.

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

1. High Faithfulness: Using context about the water cycle

   - Shows how well the model stays faithful to provided information
   - Demonstrates accurate representation without embellishment

2. Mixed Faithfulness: Using context about human digestion
   - Shows how the model handles complex biological processes
   - Demonstrates balance between completeness and faithfulness

## Understanding the Results

The metric provides:

- A score between 0 and 1 indicating faithfulness to context
- Detailed reasoning about adherence to provided information
- Analysis of any unsupported claims or deviations

## Additional Resources

For more information, check out:

- [Faithfulness Documentation](https://mastra.ai/docs/examples/evals/faithfulness)
- [Mastra Evals Documentation](https://mastra.ai/docs/examples/evals)
