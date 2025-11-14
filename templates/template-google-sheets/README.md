# Google Sheets Financial Modeling Agent Template

A Mastra template showcasing a financial modeling agent that integrates with Google Sheets through [Composio](https://composio.dev). This agent specializes in creating professional-grade financial models, projections, and analysis directly in Google Sheets.

## Overview

This template demonstrates the powerful integration between **Mastra** and **Composio** to create an intelligent agent that can:

- 📊 Create sophisticated financial models in Google Sheets
- 📈 Build multi-year projections with detailed granularity
- 🔄 Develop integrated three-statement models (P&L, Balance Sheet, Cash Flow)
- 📋 Design scenario planning frameworks and sensitivity analysis
- 🎯 Provide professional spreadsheet design and formatting
- 💾 Maintain conversation memory and context.

## Key Technologies

- **[Mastra](https://mastra.ai)**: Core AI agent framework providing memory, tools integration, and conversation management
- **[Composio](https://composio.dev)**: Tool integration platform enabling seamless Google Sheets connectivity and authentication
- **Claude 3.7 Sonnet**: Language model for financial expertise and reasoning
- **LibSQL**: Local database for agent memory and vector storage
- **FastEmbed**: Efficient embeddings for semantic memory recall

## Prerequisites

Before using this template, ensure you have:

1. **Node.js 20.9.0 or higher** installed
2. **Composio account** with Google Sheets integration configured
3. **Anthropic API key** for Claude access
4. **Google account** for Sheets integration (configured through Composio)

## Required Configuration

### Environment Variables

Create a `.env` file in the project root with the following variables:

```env
# Composio Configuration
COMPOSIO_API_KEY=***
COMPOSIO_AUTH_CONFIG_ID=***

# AI Model Configuration
ANTHROPIC_API_KEY=***
```

### Composio Setup

1. **Create a Composio account** at [composio.dev](https://composio.dev)
2. **Create a new Composio project**
3. **Set up Google Sheets integration**:
   - Navigate to your Composio dashboard
   - Create a new auth config
   - Enable the Google Sheets toolkit
   - Configure OAuth settings for Google Sheets access
   - Note your `COMPOSIO_AUTH_CONFIG_ID` from the integration settings
4. **Get your Composio API key** from your account settings

### Anthropic API Setup

1. **Create an Anthropic account** at [console.anthropic.com](https://console.anthropic.com)
2. **Generate an API key**
3. **Add credits** to your Anthropic account for API usage

## Installation & Usage

1. **Use this template**:

   ```bash
   npx create-mastra@latest --template google-sheets
   ```

2. **Install dependencies**:

   ```bash
   pnpm install
   ```

3. **Configure environment variables**:

   ```bash
   cp .env.example .env
   # Edit .env with your actual API keys and configuration
   ```

4. **Start the development server**:

   ```bash
   pnpm dev
   ```

5. **Access the agent**:
   - API documentation: `http://localhost:4111/docs`
   - Agent endpoint: `http://localhost:41111/api/agents/financialModelingAgent`

## Agent Features

### Authentication Flow

- Automatic Google OAuth integration through Composio
- Dynamic authentication prompts when user needs to authenticate
- Seamless reconnection handling for expired tokens

### Financial Modeling Capabilities

- **Revenue Analysis**: Model diverse revenue streams (SaaS, transactional, recurring)
- **Cost Structure**: Build detailed COGS and operational expense models
- **Cash Flow**: Create comprehensive cash flow projections
- **Scenario Planning**: Design optimistic, base, and pessimistic scenarios
- **Visualizations**: Generate charts and executive summary dashboards

### Memory & Context

- **Persistent Memory**: LibSQL-backed storage for conversation history
- **Semantic Recall**: Intelligent retrieval of relevant past interactions
- **Working Memory**: Maintains context within conversation threads
- **Thread Management**: Automatic title generation and organization

## Project Structure

```
template-google-sheets/
├── src/
│   └── mastra/
│       ├── agents/
│       │   └── financial-modeling-agent.ts    # Main agent configuration
│       └── index.ts                           # Mastra instance & middleware
├── .env.example                               # Environment variables template
├── package.json                               # Dependencies & scripts
├── tsconfig.json                              # TypeScript configuration
└── README.md                                  # This file
```

## Key Implementation Details

### Dynamic Authentication

The agent uses runtime context to determine authentication state and provides appropriate instructions:

- When unauthenticated: Provides OAuth redirect URL and authentication instructions
- When authenticated: Proceeds directly to financial modeling tasks

### Tool Integration

- **Dynamic Tool Loading**: Composio tools are loaded based on user's authenticated account
- **Google Sheets Integration**: Full access to Sheets API through Composio's normalized interface

### Memory System

- **Vector Storage**: FastEmbed-powered semantic search across conversation history
- **Contextual Recall**: Retrieves relevant financial models and discussions from past sessions
- **Thread Continuity**: Maintains context across multiple modeling sessions

## Customization

### Modifying the Agent

Edit `src/mastra/agents/financial-modeling-agent.ts` to:

- Adjust the agent's expertise and instructions
- Modify the authentication flow
- Add additional capabilities or constraints

### Adding Tools

The agent automatically receives Google Sheets tools through Composio. To add custom tools:

1. Implement tools in the agent configuration
2. Add them to the tools function alongside Composio tools

### Memory Configuration

Adjust memory settings in the agent configuration:

- `lastMessages`: Number of recent messages to include
- `semanticRecall`: Vector search parameters
- `workingMemory`: Enable/disable working memory features

## Troubleshooting

### Authentication Issues

- Verify `COMPOSIO_AUTH_CONFIG_ID` matches your Google Sheets integration
- Ensure Google OAuth is properly configured in Composio dashboard
- Check that user has necessary Google Sheets permissions

### API Errors

- Confirm `ANTHROPIC_API_KEY` is valid and has sufficient credits
- Verify `COMPOSIO_API_KEY` has access to Google Sheets integration
- Check rate limits and API quotas

## Support

For questions and support:

- **Mastra Documentation**: [mastra.ai/docs](https://mastra.ai/docs)
- **Composio Documentation**: [docs.composio.dev](https://docs.composio.dev)
- **Template Issues**: Create an issue in the Mastra templates repository
