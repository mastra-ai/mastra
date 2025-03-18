# Custom Eval Metric Example

This example demonstrates how to create a custom LLM-based evaluation metric in Mastra to check recipes for gluten content.

## Prerequisites

- Node.js v20.0+
- pnpm (recommended) or npm
- OpenAI API key (required for LLM-based evaluation)

## Getting Started

1. Clone the repository and navigate to the project directory:

   ```bash
   git clone https://github.com/mastra-ai/mastra
   cd examples/basics/evals/custom-eval
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
   pnpm install
   ```

4. Run the example:

   ```bash
   pnpm start
   ```

## Overview

This example shows how to create a custom LLM-based metric to evaluate recipes for gluten content. It demonstrates:

- Using a custom metric with an agent
- Evaluating recipe responses
- Identifying gluten sources
- Providing detailed feedback

## Example Structure

The example includes two scenarios:

1. Recipe with gluten (pasta recipe)
2. Gluten-free recipe (rice and beans)

Each evaluation provides:

- A binary score (1 for gluten-free, 0 for contains gluten)
- List of identified gluten sources
- Detailed reasoning for the verdict

## Expected Output

The example will output:

```
Example 1 - Recipe with Gluten:
Input: "Can you give me a simple pasta recipe with exact measurements and timing?"
Agent Response: [Recipe details...]
Metric Result: {
  score: 0,
  glutenSources: ["pasta (wheat)"],
  reason: "The recipe contains gluten from wheat-based pasta."
}

Example 2 - Gluten-Free Recipe:
Input: "What is a quick way to make rice and beans?"
Agent Response: [Recipe details...]
Metric Result: {
  score: 1,
  glutenSources: [],
  reason: "The recipe is gluten-free as rice and beans do not contain gluten."
}
```

## Key Components

- `GlutenCheckerMetric`: LLM-based metric for evaluating gluten content in recipes
- Integration with Chef Michel agent for recipe generation
- Simple binary scoring system:
  - 0: Recipe contains gluten
  - 1: Recipe is gluten-free
