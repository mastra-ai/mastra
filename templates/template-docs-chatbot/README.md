# Docs Chatbot Template

This template contains two main components:

- A standalone MCP (Model Context Protocol) server that exposes documentation tools for consumption by any MCP client.
- A Mastra agent that consumes tools from an MCP server to provide documentation assistance.

The documentation agent uses the MCP client to connect to the MCP server and access the documentation tools. You can run both components together to have a complete documentation chatbot solution.

## Why we built this

This template demonstrates how you can use Mastra to build an MCP server and connect it to a Mastra agent. This template is highly relevant for all documentation use cases.

## Demo

This demo runs in Mastra Studio, but you can connect this workflow to your React, Next.js, or Vue app using the [Mastra Client SDK](https://mastra.ai/docs/server/mastra-client) or agentic UI libraries like [AI SDK UI](https://mastra.ai/guides/build-your-ui/ai-sdk-ui), [CopilotKit](https://mastra.ai/guides/build-your-ui/copilotkit), or [Assistant UI](https://mastra.ai/guides/build-your-ui/assistant-ui).

## Prerequisites

- [OpenAI API key](https://platform.openai.com/api-keys): Used by default, but you can swap in any model

## Quickstart 🚀

1. **Clone the template**
   - Run `npx create-mastra@latest --template TEMPLATE_NAME` to scaffold the project locally.
2. **Add your API keys**
   - Copy `.env.example` to `.env` and fill in your keys.
3. **Start the dev server**
   - Run `npm run dev` and open [localhost:4111](http://localhost:4111) to try it out.

## Making it yours

Open the **Kepler Docs Agent** and ask it a question like: "Tell me about the getPlanetaryData function". The agent will use the tools from the MCP server to fetch documentation about the function and provide a helpful response.

Replace `src/mcp-server/data/functions.json` with your own documentation data to create a custom documentation assistant for your project. Or change `src/mcp-server/tools/docs-tool.ts` completely to fetch data from another source. You can also modify the agent instructions in `src/mastra/agents/docs-agent.ts` to change how the agent responds.

## About Mastra templates

[Mastra templates](https://mastra.ai/templates) are ready-to-use projects that show off what you can build — clone one, poke around, and make it yours. They live in the [Mastra monorepo](https://github.com/mastra-ai/mastra) and are automatically synced to standalone repositories for easier cloning.

Want to contribute? See [CONTRIBUTING.md](./CONTRIBUTING.md).
