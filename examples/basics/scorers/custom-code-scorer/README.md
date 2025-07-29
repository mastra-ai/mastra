# Custom Code Scorer Example

This example demonstrates how to create a custom scorer using Mastra's scoring framework to evaluate specific criteria in your application.

## Prerequisites

- Node.js v20.0+
- pnpm (recommended) or npm

## Getting Started

1. Clone the repository and navigate to the project directory:

   ```bash
   git clone https://github.com/mastra-ai/mastra
   cd examples/basics/scorers/custom-code-scorer
   ```

2. Install dependencies:

   ```bash
   pnpm install --ignore-workspace
   ```

3. Run the example:

   ```bash
   pnpm start
   ```

## Overview

This example shows how to build a custom **Word Inclusion Scorer** that evaluates whether output text contains words from the input text. The custom scorer demonstrates:

- Creating a scorer using the `createScorer` function
- Implementing custom analysis logic
- Tokenizing and processing text
- Calculating inclusion ratios based on word matching
- Returning structured results with scores and metadata

The scorer tokenizes both input and output text, then calculates what percentage of input words appear in the output.

## Example Structure

The example includes three scenarios:

1. **Perfect Word Inclusion**: Testing when all input words appear in the output (fruits example)
2. **Partial Word Inclusion**: Testing when some input words appear in the output (programming languages)
3. **No Word Inclusion**: Testing when no input words appear in the output (sports vs hobbies)

Each scenario demonstrates:

- Using the custom scorer with different input/output pairs
- Calculating word inclusion percentages
- Interpreting results with word matching statistics

## Expected Output

The example will output:

- The input query and output text for each scenario
- The scorer result with:
  - Score (0-1, where 1 indicates all input words are included)
  - Analyze step results showing:
    - Total number of unique words in input
    - Number of matched words found in output

## Key Components

- `createScorer`: Function from `@mastra/core/scores` for building custom scorers
- Custom scorer configuration:
  - `name`: Descriptive name for the scorer
  - `description`: Explanation of what the scorer evaluates
  - `analyze`: Custom function that implements the scoring logic
- `scorer.run()`: Method to evaluate input/output pairs
  - Takes `{ input, output }` where:
    - `input`: Array with query objects (e.g., `[{ query: 'text' }]`)
    - `output`: Object with text property (e.g., `{ text: 'response' }`)
  - Returns results with:
    - `score`: Numerical inclusion ratio (0-1)
    - `analyzeStepResult`: Custom analysis data including word counts
