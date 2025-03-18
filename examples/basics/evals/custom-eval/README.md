# Custom Eval Metric Example

This example demonstrates how to create a custom LLM-based evaluation metric in Mastra to assess recipe completeness.

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

This example shows how to create a custom LLM-based metric to evaluate recipe completeness. It demonstrates:

- Creating a custom LLM judge
- Implementing a metric using the judge
- Handling evaluation results
- Providing detailed feedback

## Example Structure

The example evaluates recipe completeness by checking:

1. Required ingredients are listed
2. Cooking steps are clear and complete
3. Important details (time, temperature, etc.) are included

Each evaluation provides:

- A binary completeness verdict (complete/incomplete)
- List of missing information
- Detailed reasoning for the score

## Expected Output

The example will output:

```
Recipe Evaluation:
Input: "How do I make pasta?"
Output: "Boil water and add pasta."
Result: {
  score: 0,
  info: {
    missing: ["cooking time", "salt", "pasta quantity", "water quantity"],
    reason: "The recipe is incomplete. It's missing essential details like quantities, cooking time, and seasoning."
  }
}
```

## Key Components

- `RecipeCompletenessJudge`: LLM-based judge for evaluating recipe completeness
- `RecipeCompletenessMetric`: Main metric class implementing the evaluation logic
- Configuration options:
  - `scale`: Adjusts the score range (default: 0-1)
  - Custom prompts for recipe evaluation
