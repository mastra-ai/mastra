# @mastra/core

Mastra is a framework for building AI-powered applications and agents with a modern TypeScript stack.

It includes everything you need to go from early prototypes to production-ready applications. Mastra integrates with frontend and backend frameworks like React, Next.js, and Node, or you can deploy it anywhere as a standalone server. It's the easiest way to build, tune, and scale reliable AI products.

This is the `@mastra/core` package, which includes the main functionality of Mastra, including agents, workflows, tools, memory, and tracing.

## Installation

`@mastra/core` is an essential building block for a Mastra application and you most likely don't want to use it as a standalone package. Therefore we recommend following the [installation guide](https://mastra.ai/docs/getting-started/installation) to get started with Mastra.

You can install the package like so:

```bash
npm install @mastra/core
```

## Core Components

- **Mastra** (`/mastra`) - Central orchestration class that initializes and coordinates all Mastra components. Provides dependency injection for agents, workflows, tools,
  memory, storage, and other services through a unified configuration interface. [Learn more about Mastra](https://mastra.ai/docs/getting-started/installation)

- **Agents** (`/agent`) - Autonomous AI entities that understand instructions, use tools, and complete tasks. Encapsulate LLM interactions with conversation history, tool
  execution, memory integration, and behavioral guidelines. [Learn more about Agents](https://mastra.ai/docs/agents/overview)

- **Workflows** (`/workflows`) - Graph-based execution engine for chaining, branching, and parallelizing LLM calls. Orchestrates complex AI tasks with state management,
  error recovery, and conditional logic. [Learn more about Workflows](https://mastra.ai/docs/workflows/overview)

- **Tools** (`/tools`) - Functions that agents can invoke to interact with external systems. Each tool has a schema and description enabling AI to understand and use them
  effectively. Supports custom tools, toolsets, and runtime context. [Learn more about Tools](https://mastra.ai/docs/tools-mcp/overview)

- **Memory** (`/memory`) - Thread-based conversation persistence with semantic recall and working memory capabilities. Stores conversation history, retrieves contextually
  relevant information, and maintains agent state across interactions. [Learn more about Memory](https://mastra.ai/docs/memory/overview)

- **MCP** (`/mcp`) - Model Context Protocol integration enabling external tool sources. Supports SSE, HTTP, and Hono-based MCP servers with automatic tool conversion and
  registration. [Learn more about MCP](https://mastra.ai/docs/tools-mcp/mcp-overview)

- **AI Tracing** (`/ai-tracing`) - Type-safe observability system tracking AI operations through spans. Provides OpenTelemetry-compatible tracing with event-driven exports,
  flexible sampling, and pluggable processors for real-time monitoring. [Learn more about AI Tracing](https://mastra.ai/docs/observability/ai-tracing/overview)

- **Storage** (`/storage`) - Pluggable storage layer with standardized interfaces for multiple backends. Supports PostgreSQL, LibSQL, MongoDB, and other databases for
  persisting agent data, memory, and workflow state. [Learn more about Storage](https://mastra.ai/docs/server-db/storage)

- **Vector** (`/vector`) - Vector operations and embedding management for semantic search. Provides unified interface for vector stores with filtering capabilities and
  similarity search. [Learn more about Vector](https://mastra.ai/docs/rag/vector-databases)

- **Server** (`/server`) - HTTP server implementation built on Hono with OpenAPI support. Provides custom API routes, middleware, authentication, and runtime context for
  deploying Mastra as a standalone service. [Learn more about Server](https://mastra.ai/docs/server-db/production-server)

- **Voice** (`/voice`) - Voice interaction capabilities with text-to-speech and speech-to-text integration. Supports multiple voice providers and real-time voice
  communication for agents. [Learn more about Voice](https://mastra.ai/docs/voice/overview)

## Additional Resources

- [Getting Started Guide](https://mastra.ai/docs/getting-started/installation)
- [API Reference](https://mastra.ai/reference)
- [Examples](https://mastra.ai/docs/examples)
- [Deployment Guide](https://mastra.ai/docs/deployment/overview)
