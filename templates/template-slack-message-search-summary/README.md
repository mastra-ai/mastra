# Template: Slack Message Search & Summary

This template demonstrates how to search Slack messages and generate AI-powered summaries using **external MCP (Model Context Protocol)** servers with Mastra. It integrates with the [Slack MCP Server](https://github.com/korotovsky/slack-mcp-server) to provide message search capabilities and intelligent conversation analysis.

## 🎯 What This Template Does

This template showcases a complete Slack integration workflow:

1. **External MCP Integration** - Connects to an external Slack MCP server for message access
2. **Intelligent Search** - Search Slack messages by keywords, channels, users, and date ranges  
3. **AI-Powered Summarization** - Generate comprehensive summaries of Slack conversations
4. **Thread Analysis** - Analyze message threads and conversation flows
5. **Insight Extraction** - Extract action items, decisions, and key points from discussions

## 🏗️ Project Structure

```
src/
├── mastra/
│   ├── agents/
│   │   └── slack-agent.ts          # Agent for Slack message search and summarization
│   ├── mcp/
│   │   └── mcp-client.ts          # Client to connect to external Slack MCP server
│   ├── tools/
│   │   └── slack-summary-tool.ts   # Tool for AI-powered message summarization
│   ├── workflows/
│   │   └── slack-workflow.ts       # End-to-end search → filter → summary workflow
│   └── index.ts                   # Main Mastra configuration
```

## 🚀 Quick Start

### 1. Prerequisites

Before using this template, you need to set up the external Slack MCP server:

```bash
# Clone and set up the Slack MCP Server
git clone https://github.com/korotovsky/slack-mcp-server.git
cd slack-mcp-server
npm install

# Configure your Slack credentials (see their README for details)
# Start the MCP server (typically runs on port 3001)
npm start
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Environment Variables

Create a `.env` file in the root directory:

```env
# OpenAI API key for AI-powered summarization
OPENAI_API_KEY=***

# External Slack MCP Server URL
SLACK_MCP_SERVER_URL=http://localhost:3001

# Optional: Server configuration
PORT=4112
NODE_ENV=development
```

### 4. Run the Application

```bash
# Start the Mastra server
pnpm dev

# The server will start on http://localhost:4112
```

## 🛠️ How It Works

### External MCP Integration (`src/mastra/mcp/mcp-client.ts`)

Connects to the external Slack MCP server to access Slack tools:

```typescript
export const mcpClient = new MCPClient({
  servers: {
    slackTools: {
      url: new URL(process.env.SLACK_MCP_SERVER_URL || 'http://localhost:3001'),
    },
  },
});
```

### Slack Agent (`src/mastra/agents/slack-agent.ts`)

The agent uses tools from the external MCP server to search and analyze Slack messages:

```typescript
export const slackAgent = new Agent({
  name: 'Slack Message Search Agent',
  instructions: 'Search Slack messages and provide intelligent summaries...',
  tools: await mcpClient.getTools(), // Dynamic tools from MCP server
});
```

### Summarization Tool (`src/mastra/tools/slack-summary-tool.ts`)

Provides AI-powered analysis of Slack conversations:

```typescript
export const slackSummaryTool = createTool({
  id: 'summarize-slack-messages',
  description: 'Generate an AI-powered summary of Slack messages and conversations',
  // Extracts key points, action items, decisions, and participants
});
```

### Complete Workflow (`src/mastra/workflows/slack-workflow.ts`)

Three-step workflow for comprehensive message analysis:

1. **Search**: Find relevant Slack messages via MCP tools
2. **Filter**: Organize messages by threads and relevance
3. **Summarize**: Generate intelligent summaries with key insights

## 📡 API Endpoints

### Health Check
```
GET /health
```
Returns server status and available services.

### Template Information  
```
GET /slack/info
```
Returns information about the template capabilities and components.

## 🔧 Key Features

### Message Search Capabilities
- **Keyword Search**: Find messages containing specific terms
- **Channel Filtering**: Search within specific Slack channels
- **User Filtering**: Find messages from particular users
- **Date Range**: Search messages within time periods
- **Thread Analysis**: Analyze complete conversation threads

### AI-Powered Summarization
- **Multiple Summary Types**: Brief, detailed, action-focused, or decision-focused
- **Key Point Extraction**: Identify the most important messages
- **Action Item Detection**: Find tasks and assignments
- **Decision Tracking**: Highlight conclusions and agreements
- **Participant Analysis**: Track conversation contributors

### Workflow Automation
- **End-to-end Processing**: From search query to final summary
- **Thread Organization**: Group related messages intelligently  
- **Relevance Scoring**: Prioritize the most important content
- **Context Preservation**: Maintain conversation flow and meaning

## 🎛️ Usage Examples

### Basic Message Search
```bash
curl -X POST http://localhost:4112/workflows/slack-message-search-summary \
  -H "Content-Type: application/json" \
  -d '{
    "query": "product launch discussion",
    "channel": "#product-team", 
    "limit": 50
  }'
```

### Advanced Search with Date Range
```bash
curl -X POST http://localhost:4112/workflows/slack-message-search-summary \
  -H "Content-Type: application/json" \
  -d '{
    "query": "quarterly planning",
    "dateRange": {
      "start": "2024-01-01",
      "end": "2024-01-31"
    },
    "user": "alice"
  }'
```

## 🔧 Customization

### Connecting Different MCP Servers

Update `src/mastra/mcp/mcp-client.ts` to connect to different Slack MCP servers:

```typescript
export const mcpClient = new MCPClient({
  servers: {
    slackTools: {
      url: new URL('https://your-slack-mcp-server.com'),
      // Add authentication if needed
    },
  },
});
```

### Modifying Summary Types

Extend `src/mastra/tools/slack-summary-tool.ts` to add custom summary formats:

```typescript
export const slackSummaryTool = createTool({
  inputSchema: z.object({
    summaryType: z.enum([
      'brief', 'detailed', 'action-items', 'decisions', 
      'custom-format' // Add your custom type
    ]),
    // ... other parameters
  }),
});
```

### Adding New Workflow Steps

Extend `src/mastra/workflows/slack-workflow.ts` with additional processing:

```typescript
const customAnalysis = createStep({
  id: 'custom-analysis',
  description: 'Custom analysis step',
  // ... implementation
});

const slackWorkflow = createWorkflow({...})
  .then(searchSlackMessages)
  .then(filterRelevantMessages)
  .then(customAnalysis)      // Add custom step
  .then(generateSlackSummary);
```

## 🌐 Deployment

### Environment Variables for Production

```env
OPENAI_API_KEY=your-production-openai-key
SLACK_MCP_SERVER_URL=https://your-slack-mcp-server.com
PORT=4112
NODE_ENV=production
```

### Docker Deployment

The template can be containerized and deployed alongside the Slack MCP server:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN pnpm install
COPY . .
RUN pnpm build
EXPOSE 4112
CMD ["pnpm", "start"]
```

## 🔒 Security Considerations

- **API Keys**: Store Slack and OpenAI credentials securely
- **Access Control**: Ensure MCP server has proper Slack workspace permissions  
- **Data Privacy**: Review message content handling and storage policies
- **Network Security**: Use HTTPS for production MCP server connections

## 📚 Learn More

- [Mastra Documentation](https://docs.mastra.ai)
- [MCP Specification](https://spec.modelcontextprotocol.io)
- [Slack MCP Server](https://github.com/korotovsky/slack-mcp-server)
- [Agent Documentation](https://docs.mastra.ai/agents)
- [Workflow Documentation](https://docs.mastra.ai/workflows)

## 🤝 Contributing

This template demonstrates MCP integration patterns - adapt it for your Slack workspace and use cases! Consider contributing improvements that could benefit the broader community.

## ⚠️ Important Notes

- **External Dependency**: This template requires the external Slack MCP server to be running
- **Slack Permissions**: Ensure proper bot permissions in your Slack workspace
- **Rate Limits**: Be mindful of Slack API rate limits when searching large volumes of messages
- **Memory Usage**: Large message datasets may require increased memory allocation