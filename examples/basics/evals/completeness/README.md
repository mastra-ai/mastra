# Completeness Metric Example

This example demonstrates how to use Mastra's Completeness metric to evaluate how thoroughly LLM-generated responses cover key elements from the input.

## Prerequisites

- Node.js v20.0+
- pnpm (recommended) or npm
- OpenAI API key

## Getting Started

1. Clone the repository and navigate to the project directory:

   ```bash
   git clone https://github.com/mastra-ai/mastra
   cd examples/basics/evals/completeness
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

The Completeness metric evaluates how well a response covers key elements from the input by:

- Extracting important elements (nouns, verbs, entities)
- Comparing input and output elements
- Calculating coverage scores
- Identifying missing elements

## Example Structure

The example includes two scenarios:

1. Complete Coverage: Testing a response about planets in the solar system
2. Partial Coverage: Testing a response about breakfast components

Each scenario demonstrates:

- Setting up the metric
- Providing context and generating a response
- Measuring completeness
- Analyzing missing elements

## Expected Output

The example will output:

- The context and query for each scenario
- The generated response
- The metric score (0-1)
- Analysis of missing elements and element counts

## Key Components

- `CompletenessMetric`: The main metric class for evaluating completeness
- `Agent`: A basic Mastra agent for generating responses
- Element analysis:
  - Input elements extracted
  - Output elements matched
  - Missing elements identified
  - Element count comparison
