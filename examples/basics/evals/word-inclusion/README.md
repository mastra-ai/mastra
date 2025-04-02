# Word Inclusion Metric Example

This example demonstrates how to create a simple custom metric in Mastra that checks if specific words are included in the output.

## Prerequisites

- Node.js v20.0+
- pnpm (recommended) or npm

## Getting Started

1. Clone the repository and navigate to the project directory:

   ```bash
   git clone https://github.com/mastra-ai/mastra
   cd examples/basics/evals/custom/word-inclusion
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

The Word Inclusion metric evaluates whether specific words appear in the output text. It provides:

- Simple word presence checking
- Score based on matched word ratio
- Count of total and matched words
- Case-sensitive matching

## Example Structure

The example includes three scenarios:

1. Full Word Inclusion: All words are present in output
2. Partial Word Inclusion: Some words are present
3. No Word Inclusion: None of the words are present

Each scenario demonstrates:

- Setting up the metric with target words
- Providing input and output text
- Measuring word inclusion
- Analyzing match statistics

## Expected Output

The example will output:

```
Example 1 - Full Word Inclusion:
Words to check: ['apple', 'banana', 'orange']
Input: List some fruits
Output: Here are some fruits: apple, banana, and orange.
Metric Result: {
  score: 1,
  info: { totalWords: 3, matchedWords: 3 }
}

Example 2 - Partial Word Inclusion:
Words to check: ['python', 'javascript', 'typescript', 'rust']
Input: What programming languages do you know?
Output: I know python and javascript very well.
Metric Result: {
  score: 0.5,
  info: { totalWords: 4, matchedWords: 2 }
}

Example 3 - No Word Inclusion:
Words to check: ['cloud', 'server', 'database']
Input: Tell me about your infrastructure
Output: We use modern technology for our systems.
Metric Result: {
  score: 0,
  info: { totalWords: 3, matchedWords: 0 }
}
```

## Key Components

- `WordInclusionMetric`: The main metric class for checking word presence
- Features:
  - Simple word matching
  - Ratio-based scoring
  - Match statistics
  - Empty input handling
