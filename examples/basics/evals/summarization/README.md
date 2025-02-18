# Summarization Metric Example

This example demonstrates how to use Mastra's Summarization metric to evaluate how well LLM-generated summaries capture content while maintaining factual accuracy.

## Prerequisites

- Node.js v20.0+
- pnpm (recommended) or npm
- OpenAI API key

## Getting Started

1. Clone the repository and navigate to the project directory:

   ```bash
   git clone https://github.com/mastra-ai/mastra
   cd examples/basics/evals/summarization
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

The Summarization metric evaluates summaries based on two key aspects:

1. Alignment (Factual Accuracy):

   - Verifies claims against source text
   - Checks for factual correctness
   - Identifies misrepresentations

2. Coverage (Information Completeness):
   - Measures inclusion of key information
   - Evaluates comprehensiveness
   - Identifies missing details

## Example Structure

The example includes three scenarios:

1. High-quality Summary:

   - Complete coverage of key information
   - Perfect factual accuracy
   - Well-balanced content

2. Partial Coverage:

   - Accurate but incomplete information
   - Good factual alignment
   - Missing some details

3. Inaccurate Summary:
   - Contains factual errors
   - Misrepresents source content
   - Demonstrates poor alignment

Each scenario demonstrates:

- Setting up the metric with OpenAI model
- Evaluating summaries for quality
- Analyzing alignment and coverage scores
- Understanding detailed feedback

## Expected Output

The example will output:

- The original text and summary
- Overall quality score (0-1)
- Detailed metrics including:
  - Alignment score
  - Coverage score
  - Reasoning for the scores

## Key Components

- `SummarizationMetric`: The main metric class for evaluating summaries
- Evaluation features:
  - Claim verification
  - Information coverage analysis
  - Factual accuracy checking
  - Comprehensive scoring
