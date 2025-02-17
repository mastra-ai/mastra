# Prompt Alignment Example

This example demonstrates how to use the Prompt Alignment metric to evaluate how well responses follow given instructions.

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

The example demonstrates three scenarios:

1. High Alignment: Weather report with specific requirements

   - Shows perfect instruction adherence
   - Demonstrates complete coverage of all instructions

2. Mixed Alignment: Product listing with formatting rules

   - Shows partial instruction adherence
   - Demonstrates handling of missing requirements

3. N/A Instructions: Weather query with irrelevant instructions
   - Shows handling of non-applicable instructions
   - Demonstrates proper scoring with irrelevant requirements

## Understanding the Results

The metric provides:

- A score between 0 and 1 indicating alignment level
- Count of applicable vs followed instructions
- Detailed reasoning for each instruction
- Handling of N/A instructions

## Additional Resources

- [Prompt Alignment Documentation](https://mastra.ai/docs/reference/evals/prompt-alignment)
- [Example Code](https://github.com/mastra-ai/mastra/tree/main/examples/basics/evals/prompt-alignment)
