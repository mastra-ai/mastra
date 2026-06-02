# Browser Agent

A powerful integration that combines the capabilities of [Browserbase's Stagehand](https://stagehand.dev) with [Mastra](https://mastra.ai/) for advanced web automation, scraping, and AI-powered web interactions.

## Why we built this

This project enables AI agents to interact with web pages through the Mastra framework using Stagehand's browser automation capabilities. It provides tools for web navigation, element observation, data extraction, and action execution, all orchestrated through Mastra's agent system.

## Features

- **Web Navigation**: Navigate to websites programmatically
- **Element Observation**: Identify and locate elements on web pages
- **Action Execution**: Perform actions like clicking buttons or filling forms
- **Data Extraction**: Extract structured data from web pages
- **Session Management**: Smart session handling with automatic timeouts and reconnection
- **AI-Powered Interactions**: Leverage OpenAI models for intelligent web interactions

## Prerequisites

- [OpenAI API key](https://platform.openai.com/api-keys) — used by default, but you can swap in any model
- [Browserbase API key](https://browserbase.com/) — for page scraping

## Quickstart 🚀

1. **Add your API keys**
   - Copy `.env.example` to `.env` and fill in your keys.
2. **Start the dev server**
   - Run `npm run dev` and open [localhost:4111](http://localhost:4111) to try it out.

## Making it yours

Open Studio and select the "Web Assistant" agent.

## About Mastra templates

[Mastra templates](https://mastra.ai/templates) are ready-to-use projects that show what you can build. Use the platform-created repository as your starting point, then customize it for your app.

Want to contribute? See [CONTRIBUTING.md](https://github.com/mastra-ai/mastra/blob/main/templates/template-browsing-agent/CONTRIBUTING.md).
