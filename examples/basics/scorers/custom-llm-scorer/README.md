# Custom LLM Scorer Example

This example demonstrates how to create a custom LLM Scorer in Mastra to check recipes for gluten content.

## Prerequisites

- Node.js v20.0+
- pnpm
- OpenAI API key (required for LLM-based evaluation)

## Getting Started

1. Clone the repository and navigate to the project directory:

   ```bash
   git clone https://github.com/mastra-ai/mastra
   cd examples/basics/scorers/custom-llm-scorer
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

4. Run the example script:

   ```bash
   pnpm start
   ```

5. Run the playground to test Live Scorers:

   ```bash
   pnpm mastra:start
   ```

   - Navigate to Agents -> chef-agent
   - Ask for a recipe about rice krispy squares
   - Ask for a recipe about Mac and Cheese
   - Navigate to Scorers -> Gluten Checker and confirm the scores for the two prompts

## Overview

This example shows how to create a custom LLM-based scorer to evaluate recipes for gluten content. It demonstrates:

- Using a custom scorer with an agent
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
Result: {
  score: 0,
  glutenSources: ["pasta"],
  reason: "The recipe contains gluten from pasta."
}

Example 2 - Gluten-Free Recipe:
Input: "What is a quick way to make rice and beans?"
Agent Response: [Recipe details...]
Result: {
  score: 1,
  glutenSources: [],
  reason: "The recipe is gluten-free as rice and beans do not contain gluten."
}
```

## Key Components

- `glutenCheckerScorer`: LLM-based scorer for evaluating gluten content in recipes
- Integration with Chef Michel agent for recipe generation
- Simple binary scoring system:
  - 0: Recipe contains gluten
  - 1: Recipe is gluten-free
