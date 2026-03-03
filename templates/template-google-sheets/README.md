# Google Sheet Analysis

A Mastra template showcasing a financial modeling agent that integrates with Google Sheets through [Composio](https://composio.dev). This agent specializes in creating professional-grade financial models, projections, and analysis directly in Google Sheets.

## Why we built this

This template demonstrates how to integrate third-party services like Composio to access external data sources while still leveraging Mastra's powerful agent framework.

## Demo

<video controls width="640" height="360" src="https://res.cloudinary.com/mastra-assets/video/upload/v1772538183/template-google-sheets_gbgosm.mp4"></video>

This demo runs in Mastra Studio, but you can connect this agent to your React, Next.js, or Vue app using the [Mastra Client SDK](https://mastra.ai/docs/server/mastra-client) or agentic UI libraries like [AI SDK UI](https://mastra.ai/guides/build-your-ui/ai-sdk-ui), [CopilotKit](https://mastra.ai/guides/build-your-ui/copilotkit), or [Assistant UI](https://mastra.ai/guides/build-your-ui/assistant-ui).

## Prerequisites

- Node.js >= 22.13.0
- An OpenAI API Key
- A Google account with access to Google Sheets
- A Composio account with Google Sheets integration configured

### Composio Setup

1. Create a Composio account at [composio.dev](https://composio.dev)
2. Create a new Composio project
3. Set up Google Sheets integration:
   - Navigate to your Composio dashboard
   - Create a new auth config
   - Enable the Google Sheets toolkit
   - Configure OAuth settings for Google Sheets access
   - Note your `COMPOSIO_AUTH_CONFIG_ID` from the integration settings
4. Get your Composio API key from your account settings

## Quick start

1. **Clone the template**
   - Run `npx create-mastra@latest --template google-sheets` to scaffold the project locally.
1. **Add your API key**
   - Copy `.env.example` to `.env` and fill in all values.
1. **Start the dev server**
   - Run `npm run dev` and open [localhost:4111](http://localhost:4111) to try it out.

Open Studio and navigate to "Financial Modeling Agent". In the system prompt you'll find a redirect URL to authenticate with Google. Open that URL and complete the OAuth flow. Afterward the prompt will update itself and all the tools are available.

Start conversing with the agent by saying "Hello". It'll tell you to create a new Google sheet and paste the ID/URL to the agent. Afterward tell the agent what you want to build.

## About Mastra templates

[Mastra templates](https://mastra.ai/templates) are ready-to-use projects that show off what you can build — clone one, poke around, and make it yours. They live in the [Mastra monorepo](https://github.com/mastra-ai/mastra) and are automatically synced to standalone repositories for easier cloning.

Want to contribute? See [CONTRIBUTING.md](https://github.com/mastra-ai/mastra/blob/main/templates/template-google-sheets/CONTRIBUTING.md).
