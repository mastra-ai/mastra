# Weather Agent Template

This is a template project that demonstrates how to create a weather agent using the Mastra framework. The agent can provide weather information and forecasts based on user queries.

## Overview

The Weather Agent template showcases how to:

- Create an AI-powered agent using Mastra framework
- Implement weather-related workflows
- Handle user queries about weather conditions
- Integrate with OpenAI's API for natural language processing
- Use scorers to evaluate agent performance (tool usage, completeness, and translation quality)

## Setup

1. Copy `.env.example` to `.env` and fill in your API keys.
2. Install dependencies: `pnpm install`
3. Run the project: `pnpm dev`.

## Model Configuration

This template supports any AI model provider through Mastra's model router. You can use models from:

- **OpenAI**: `openai/gpt-4o-mini`, `openai/gpt-4o`
- **Anthropic**: `anthropic/claude-sonnet-4-5-20250929`, `anthropic/claude-haiku-4-5-20250929`
- **Google**: `google/gemini-2.5-pro`, `google/gemini-2.0-flash-exp`
- **Groq**: `groq/llama-3.3-70b-versatile`, `groq/llama-3.1-8b-instant`
- **Cerebras**: `cerebras/llama-3.3-70b`
- **Mistral**: `mistral/mistral-medium-2508`

Set the `MODEL` environment variable in your `.env` file to your preferred model.

## Environment Variables

- `OPENAI_API_KEY`: Your API key for your chosen provider. [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
