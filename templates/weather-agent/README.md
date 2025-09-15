# Weather Agent Template

This is a template project that demonstrates how to create a weather agent using the Mastra framework. The agent can provide weather information and forecasts based on user queries, with integrated quality evaluation through custom and built-in scorers.

## Overview

The Weather Agent template showcases how to:

- Create an AI-powered agent using Mastra framework
- Implement weather-related workflows with activity suggestions
- Handle user queries about weather conditions
- Integrate with OpenAI's API for natural language processing
- **Evaluate response quality with custom and built-in scorers**
- **Monitor agent performance with automatic scoring**

## Setup

1. Copy `.env.example` to `.env` and fill in your API keys.
2. Install dependencies: `pnpm install`
3. Run the project: `pnpm dev`.

## Environment Variables

- `OPENAI_API_KEY`: Your OpenAI API key. [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)

## Integrated Scorers

This template includes comprehensive evaluation capabilities to ensure high-quality responses:

### Custom Domain-Specific Scorers

- **Weather Accuracy Scorer**: Validates weather data accuracy, location matching, and completeness
- **Activity Relevance Scorer**: Ensures activity suggestions are appropriate for weather conditions

### Built-in General-Purpose Scorers

- **Answer Relevancy**: Verifies responses directly address user queries
- **Prompt Alignment**: Checks instruction following and format compliance
- **Completeness**: Validates all requested information is included
- **Tone Consistency**: Maintains consistent communication style

Scorers run asynchronously and don't impact response times. Results are stored for analysis and continuous improvement.

See [SCORERS.md](./SCORERS.md) for detailed documentation on the evaluation system.
