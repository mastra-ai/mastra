# Completeness Metric Example

This example demonstrates how to use Mastra's Completeness metric to evaluate how thoroughly LLM-generated responses cover key elements from the input.

## Prerequisites

- Node.js v20.0+
- pnpm (recommended) or npm

## Getting Started

1. Clone the repository and navigate to the project directory:

   ```bash
   git clone https://github.com/mastra-ai/mastra
   cd examples/basics/evals/completeness
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Run the example:

   ```bash
   pnpm start
   ```

## Overview

The Completeness metric evaluates how thoroughly responses cover key elements from the input. It evaluates:

- Coverage of important elements (nouns, verbs, entities)
- Presence of required information
- Missing or incomplete elements
- Element count and distribution

## Example Structure

The example includes three scenarios:

1. High Completeness: Testing primary colors enumeration
2. Mixed Completeness: Testing partial color listing
3. Low Completeness: Testing seasons enumeration

Each scenario demonstrates:

- Setting up the metric with input elements
- Generating responses to evaluate
- Measuring element coverage
- Interpreting the results with detailed reasoning

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
