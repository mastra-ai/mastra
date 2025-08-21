# Documentation Chatbot Template

A comprehensive monorepo template for building documentation chatbots using Mastra with separate MCP server and agent components.

## Architecture Overview

This template demonstrates a modular architecture separating concerns between:

- **MCP Server**: Standalone server that exposes documentation tools via HTTP/SSE
- **Agent**: Mastra agent that consumes tools from the MCP server
- **Web/Docs Apps**: Frontend applications for user interaction

## What's inside?

This template includes the following apps and packages:

### Apps

- `apps/agent`: Mastra agent that connects to MCP servers for documentation assistance
- `apps/mcp-server`: Standalone MCP server exposing documentation tools
- `apps/docs`: Next.js documentation site
- `apps/web`: Next.js web application

### Packages

- `packages/ui`: Shared React component library
- `packages/eslint-config`: ESLint configurations
- `packages/typescript-config`: TypeScript configurations

## Getting Started

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Set up environment files:

   ```bash
   # Copy environment files for each app
   cp apps/mcp-server/.env.example apps/mcp-server/.env
   cp apps/agent/.env.example apps/agent/.env
   ```

3. Add your OpenAI API key to `apps/agent/.env`:

   ```
   OPENAI_API_KEY=your_openai_api_key_here
   ```

4. Start the development servers:

   ```bash
   # Start all services
   pnpm dev

   # Or start individual services
   pnpm dev:mcp      # MCP server (port 4111)
   pnpm dev:agent    # Agent server (port 4112)
   pnpm dev:web      # Web app (port 3000)
   pnpm dev:docs     # Docs app (port 3001)
   ```

## Usage

### MCP Server (Port 4111)

The MCP server exposes documentation tools via HTTP/SSE:

```bash
# Check server status
curl http://localhost:4111/mcp

# Connect with MCP client
curl -X POST http://localhost:4111/mcp/message \
  -H "Content-Type: application/json" \
  -d '{"method": "tools/list"}'
```

### Agent Server (Port 4112)

The agent consumes MCP tools and provides chat functionality:

```bash
# Chat with the docs agent
curl -X POST http://localhost:4112/agents/docsAgent/chat \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Tell me about getPlanetaryData"}]}'

# Health check
curl http://localhost:4112/health
```

## Development

### Building

Build all apps and packages:

```bash
pnpm build
```

Build specific apps:

```bash
pnpm build --filter=@templates/mcp-server
pnpm build --filter=@templates/agent
```

### Development Scripts

- `pnpm dev` - Start all development servers
- `pnpm dev:mcp` - Start only MCP server
- `pnpm dev:agent` - Start only agent server
- `pnpm dev:web` - Start only web app
- `pnpm dev:docs` - Start only docs app
- `pnpm lint` - Run linting across all packages
- `pnpm format` - Format code with Prettier
- `pnpm check-types` - Run TypeScript type checking

## Customization

### MCP Server

- Replace `apps/mcp-server/src/data/functions.json` with your documentation data
- Modify tools in `apps/mcp-server/src/tools/`
- Add new tools and register them in `apps/mcp-server/src/server.ts`

### Agent

- Update agent instructions in `apps/agent/src/mastra/agents/docs-agent.ts`
- Configure MCP server connections in `apps/agent/src/mastra/mcp/mcp-client.ts`
- Add new agents in `apps/agent/src/mastra/agents/`

### Frontend Apps

- Customize the web interface in `apps/web/`
- Update documentation site in `apps/docs/`
- Modify shared UI components in `packages/ui/`

## Architecture Benefits

This separation provides several advantages:

1. **Modularity**: MCP server can be deployed independently and consumed by multiple clients
2. **Scalability**: Each component can be scaled separately based on load
3. **Flexibility**: Different frontends can consume the same MCP server
4. **Development**: Teams can work on different components independently
5. **Deployment**: Components can be deployed to different environments or platforms

## Deployment

Each app should be deployed independently:

- **MCP Server**: Deploy as a standalone service (Docker, serverless, etc.)
- **Agent**: Deploy with Mastra's built-in deployment options
- **Web/Docs**: Deploy to Vercel, Netlify, or other hosting platforms

The Agent app should be deployed first, then the deployment URL should be added to the MCP server's `MCP_SERVER_URL` environment variable.

## Learn More

- [Mastra Documentation](https://docs.mastra.ai)
- [MCP Protocol](https://docs.mastra.ai/mcp)
- [Turborepo Documentation](https://turborepo.com/docs)
