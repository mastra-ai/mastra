# Template: Docs Chatbot with MCP Server

This template demonstrates how to build a documentation chatbot using **MCP (Model Control Protocol)** servers with Mastra. It shows how to define and consume an MCP server that provides tools for interacting with your documentation.

## 🎯 What This Template Shows

This template illustrates the complete MCP workflow:

1. **Define an MCP Server** - Creates tools that can interact with your documentation
2. **Consume the MCP Server** - Connects to the server to use those tools
3. **Agent Integration** - Uses an agent that can leverage the MCP tools

In this example, the "documentation" is **planet data**, but you can easily replace this with your own documentation source (APIs, databases, files, etc.).

## 🔧 What is MCP?

**Model Control Protocol (MCP)** is a standard for connecting AI assistants to external tools and data sources. It allows you to:

- Create reusable tools that any MCP-compatible client can use
- Securely expose your data and APIs to AI agents
- Build modular, interoperable AI systems

## 🏗️ Project Structure

```
src/
├── data/
│   └── functions.json          # Sample documentation data
├── mastra/
│   ├── agents/
│   │   └── kepler-agent.ts  # Agent that uses MCP tools
│   ├── mcp/
│   │   ├── mcp-client.ts     # Client to connect to MCP server
│   │   └── mcp-server.ts     # MCP server definition
│   ├── tools/
│   │   └── docs-tool.ts   # Tool for querying Kepler function data
│   └── index.ts              # Main Mastra configuration
└── scripts/
    └── mcp-server-http.ts    # Standalone MCP server runner
```

## 🚀 Quick Start

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Environment Variables

Create a `.env` file in the root directory:

```env
# Optional: Customize server URLs (defaults work for local development)
MCP_SERVER_URL=http://localhost:4111/mcp
SERVER_BASE_URL=http://localhost:4111

# Optional: Set to production for HTTPS in deployed environments
NODE_ENV=development
```

### 3. Run the Application

```bash
# Start the Mastra server (includes MCP server)
pnpm dev

# Or run the standalone MCP server
pnpm run mcp-server
```

### 4. Test the Setup

The server will start on `http://localhost:4112` with these endpoints:

- **Health Check**: `GET /health`
- **MCP Info**: `GET /mcp/info`
- **MCP Endpoint**: `GET /mcp` (Server-Sent Events)

## 🛠️ How It Works

### MCP Server (`src/mastra/mcp/mcp-server.ts`)

The MCP server exposes tools that can interact with your documentation:

```typescript
export const mcpServer = new MCPServer({
  name: 'Template Docs Chatbot MCP Server',
  tools: {
    keplerInfoTool, // Your documentation query tool
  },
});
```

### MCP Client (`src/mastra/mcp/mcp-client.ts`)

The client connects to the MCP server to use its tools:

```typescript
export const mcpClient = new MCPClient({
  servers: {
    localTools: {
      url: new URL(process.env.MCP_SERVER_URL || 'http://localhost:4111/mcp'),
    },
  },
});
```

### Documentation Tool (`src/mastra/tools/docs-tool.ts`)

Query documentation for Kepler project functions with their arguments:

```typescript
export const keplerInfoTool = createTool({
  id: 'docs-tool',
  description: 'Get detailed information about Kepler project functions, including arguments and helpful tips',
  // ... tool configuration
});
```

### Agent (`src/mastra/agents/kepler-agent.ts`)

The Kepler Documentation Agent that can answer questions about available functions:

```typescript
export const keplerAgent = new Agent({
  name: 'Kepler Documentation Agent',
  instructions: 'You are a helpful assistant that provides information about Kepler project functions.',
  // ... agent configuration
});
```

## 🔄 Customizing for Your Documentation

To adapt this template for your own documentation:

### 1. Replace the Data Source

- Update `src/data/functions.json` with your documentation data (including function arguments)
- Or connect to your API, database, or file system

### 2. Modify the Tool

Edit `src/mastra/tools/docs-tool.ts`:

```typescript
export const myDocsInfoTool = createTool({
  id: 'my-docs-info',
  description: 'Search and retrieve information from my documentation',
  inputSchema: z.object({
    query: z.string().describe('Search query for documentation'),
  }),
  execute: async ({ context, input }) => {
    // Implement your documentation search logic
    const results = await searchMyDocs(input.query);
    return { results };
  },
});
```

### 3. Update the Agent

Modify `src/mastra/agents/kepler-agent.ts`:

```typescript
export const myDocsAgent = new Agent({
  name: 'myDocsAgent',
  instructions:
    'You are a helpful assistant that provides information from our documentation. Use the available tools to search and retrieve relevant information.',
  model: {
    provider: 'ANTHROPIC',
    name: 'claude-3-5-sonnet-20241022',
  },
  tools: await mcpClient.getTools(),
});
```

### 4. Register Your Changes

Update `src/mastra/index.ts`:

```typescript
export const mastra = new Mastra({
  agents: {
    myDocsAgent, // Your agent
  },
  mcpServers: {
    myDocs: mcpServer, // Your MCP server
  },
  // ... rest of configuration
});
```

## 🌐 Deployment

This template is configured to work in both local and production environments:

### Environment Variables for Production

```env
MCP_SERVER_URL=https://your-app.com/mcp
SERVER_BASE_URL=https://your-app.com
NODE_ENV=production
```

## 📡 API Endpoints

### Health Check

```
GET /health
```

Returns server status and available services.

### MCP Information

```
GET /mcp/info
```

Returns information about the MCP server and available tools.

### MCP Server-Sent Events

```
GET /mcp
```

The main MCP endpoint for tool communication.

## 🔧 Development

### Available Scripts

```bash
# Start the main Mastra server
pnpm start

# Run standalone MCP server
pnpm run mcp-server

# Development mode with hot reload
pnpm dev
```

### Adding New Tools

1. Create a new tool in `src/mastra/tools/`
2. Register it in the MCP server (`src/mastra/mcp/mcp-server.ts`)
3. The agent will automatically have access to use it

## 📚 Learn More

- [Mastra Documentation](https://docs.mastra.ai)
- [MCP Specification](https://spec.modelcontextprotocol.io)
- [Agent Documentation](https://docs.mastra.ai/agents)
- [Tools Documentation](https://docs.mastra.ai/tools)

## 🤝 Contributing

This is a template - feel free to fork it and adapt it for your needs! If you create improvements that could benefit others, consider contributing back.
