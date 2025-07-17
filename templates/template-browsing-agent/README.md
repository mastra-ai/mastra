# Stagehand & Mastra Integration

A powerful integration that combines the capabilities of [Browserbase's Stagehand](https://stagehand.dev) with [Mastra](https://mastra.ai/) for advanced web automation, scraping, and AI-powered web interactions.

## Overview

This project enables AI agents to interact with web pages through the Mastra framework using Stagehand's browser automation capabilities. It provides tools for web navigation, element observation, data extraction, and action execution, all orchestrated through Mastra's agent system.

## Features

- **Web Navigation**: Navigate to websites programmatically
- **Element Observation**: Identify and locate elements on web pages
- **Action Execution**: Perform actions like clicking buttons or filling forms
- **Data Extraction**: Extract structured data from web pages
- **Session Management**: Smart session handling with automatic timeouts and reconnection
- **AI-Powered Interactions**: Leverage OpenAI models for intelligent web interactions

## Installation

### Prerequisites

- Node.js (v20+)
- pnpm
- Browserbase account
- OpenAI API access

### Setup

1. Clone the repository:

   ```
   git clone https://github.com/mastra-ai/template-browsing-agent.git
   cd template-browsing-agent
   ```

2. Install dependencies:

   ```
   pnpm install
   ```

3. Create a `.env` file with your API keys:
   ```
   BROWSERBASE_PROJECT_ID=your_project_id
   BROWSERBASE_API_KEY=your_api_key
   OPENAI_API_KEY=your_openai_key
   ```

## Usage

### Running the development server

```
pnpm run dev
```

This will start the Mastra development server, giving you access to the integrated web agent.

## Architecture

### Core Components

1. **Stagehand Session Manager**
   - Handles browser session initialization and management
   - Implements automatic session timeouts
   - Provides error recovery and reconnection logic

2. **Mastra Tools**
   - `stagehandActTool`: Performs actions on web pages
   - `stagehandObserveTool`: Identifies elements on web pages
   - `stagehandExtractTool`: Extracts data from web pages

3. **Web Agent**
   - AI-powered agent using OpenAI's model
   - Provides natural language interface to web automation
   - Integrates all tools into a unified experience

### Flow Diagram

```
User Query → Mastra Agent → Stagehand Tools → Browser Interaction → Web Page → Data/Results → Agent Response
```

## Configuration

The project can be configured through the `.env` file and by modifying the agent instructions in `src/mastra/agents/index.ts`.

## Credits

This project is built with:

- [Mastra](https://mastra.ai) - AI Agent framework
- [Stagehand by Browserbase](https:/stagehand.dev) - Browser automation
- [OpenAI](https://openai.com/) - AI models
