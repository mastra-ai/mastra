# Agent Template

A Mastra agent that consumes tools from an MCP server to provide documentation assistance.

## What's included

- **Documentation Agent**: Agent that uses MCP tools to answer questions about project functions
- **MCP Client**: Client configuration to connect to an MCP server
- **Health Check**: API endpoint for monitoring agent status

## Getting Started

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Copy environment file:

   ```bash
   cp .env.example .env
   ```

3. Add your OpenAI API key to `.env`:

   ```
   OPENAI_API_KEY=your_openai_api_key_here
   ```

4. Make sure an MCP server is running (default: http://localhost:4111/mcp)

5. Start the development server:
   ```bash
   pnpm dev
   ```

The agent will be available at `http://localhost:4112`.

## Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm test` - Run tests

## Configuration

Environment variables:

- `PORT` - Port for the agent server (default: 4112)
- `NODE_ENV` - Environment mode (development/production)
- `MCP_SERVER_URL` - URL of the MCP server to connect to
- `OPENAI_API_KEY` - Your OpenAI API key

## Usage

### Chat with the Agent

You can interact with the documentation agent through the Mastra server endpoints:

```bash
# Chat with the docs agent
curl -X POST http://localhost:4112/agents/docsAgent/chat \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Tell me about the getPlanetaryData function"}]}'
```

### Health Check

```bash
curl http://localhost:4112/health
```

## MCP Integration

This agent connects to an MCP server to get tools dynamically. The MCP client is configured in `src/mastra/mcp/mcp-client.ts` and can connect to any MCP server that implements the required tools.

## Customization

- Modify the agent instructions in `src/mastra/agents/docs-agent.ts`
- Change the MCP server connection in `src/mastra/mcp/mcp-client.ts`
- Add additional agents in the `src/mastra/agents/` directory
- Configure additional API routes in `src/mastra/index.ts`
