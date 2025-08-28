# @mastra/agent-builder

A specialized AI agent for building production-ready Mastra applications, agents, tools, and workflows from natural language requirements.

## Installation

```bash
npm install @mastra/agent-builder
```

## Overview

`@mastra/agent-builder` is a meta-agent that helps developers create Mastra applications by:

- **Agent Generation**: Create specialized AI agents from natural language descriptions
- **Tool Creation**: Generate custom tools with proper schemas and validation
- **Workflow Building**: Design and implement complex multi-step workflows
- **Project Management**: Handle dependencies, configuration, and project structure
- **Code Validation**: Ensure generated code follows best practices and passes linting

## Key Features

- **Mastra Expert Knowledge**: Deep understanding of Mastra patterns and conventions
- **Production-Ready Code**: Generates complete, working implementations
- **Project Context Aware**: Understands existing codebase structure and integrates seamlessly
- **Quality Assurance**: Built-in validation and testing capabilities
- **MCP Integration**: Leverages Model Context Protocol for enhanced tooling

## Quick Start

```typescript
import { AgentBuilder } from '@mastra/agent-builder';
import { openai } from '@ai-sdk/openai';

const builder = new AgentBuilder({
  model: openai('gpt-4'),
  summaryModel: openai('gpt-4'),
  projectPath: '/path/to/your/project',
});

// Generate an agent from natural language
const result = await builder.generateAgent(
  'Create a weather agent that can get current weather and suggest activities',
);
```

## Configuration

The AgentBuilder requires a configuration object with:

- `model`: The primary language model for code generation
- `summaryModel`: A model for summarizing tool calls and results
- `projectPath`: Path to your Mastra project
- `instructions`: Optional additional instructions
- `tools`: Optional additional tools to include

## Advanced Usage

### Custom Project Management

```typescript
// Install packages
await builder.tools.manageProject({
  action: 'install',
  packages: [{ name: '@mastra/workflows', version: 'latest' }],
});

// Validate generated code
await builder.tools.validateCode({
  validationType: ['types', 'lint'],
  files: ['src/agents/my-agent.ts'],
});
```

### Server Management

```typescript
// Start development server
await builder.tools.manageServer({
  action: 'start',
  port: 4200,
});

// Test API endpoints
await builder.tools.httpRequest({
  method: 'GET',
  url: '/health',
  baseUrl: 'http://localhost:4200',
});
```

## Memory and Processing

The AgentBuilder includes specialized memory processors:

- **ToolSummaryProcessor**: Caches and summarizes tool call results
- **WriteToDiskProcessor**: Saves conversation history for debugging
- **TokenLimiter**: Manages context window size

## Best Practices

1. **Provide Clear Requirements**: The more specific your requirements, the better the generated code
2. **Use Project Context**: Let the agent explore your existing codebase structure
3. **Validate Output**: Always run the validation tools after code generation
4. **Iterative Development**: Start with simple agents and add complexity incrementally

## License

Apache-2.0
