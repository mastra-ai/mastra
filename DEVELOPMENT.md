# Mastra Development Guide

This guide provides instructions for developers who want to contribute to or work with the Mastra codebase.

## Prerequisites

- **Node.js** (v20.0+)
- **pnpm** (v9.7.0+) - Mastra uses pnpm for package management
- **Docker** (for local development services)

## Repository Structure

Mastra is organized as a monorepo with the following key directories:

- **packages/** - Core packages that make up the Mastra framework

  - **core/** - The foundation of the Mastra framework that provides essential components including agent system, LLM abstractions, workflow orchestration, vector storage, memory management, and tools infrastructure
  - **cli/** - Command-line interface for creating, running, and managing Mastra projects, including the interactive playground UI for testing agents and workflows
  - **deployer/** - Server infrastructure and build tools for deploying Mastra applications to various environments, with API endpoints for agents, workflows, and memory management
  - **rag/** - Retrieval-augmented generation tools for document processing, chunking, embedding, and semantic search with support for various reranking strategies
  - **memory/** - Memory systems for storing and retrieving conversation history, vector data, and application state across sessions
  - **evals/** - Evaluation frameworks for measuring LLM performance with metrics for accuracy, relevance, toxicity, and other quality dimensions
  - **mcp/** - Model Context Protocol implementation for standardized communication with AI models, enabling tool usage and structured responses across different providers

- **deployers/** - Platform-specific deployment adapters for services like Vercel, Netlify, and Cloudflare, handling environment configuration and serverless function deployment
- **stores/** - Storage adapters for various vector and key-value databases, providing consistent APIs for data persistence across different storage backends

- **voice/** - Speech-to-text and voice processing capabilities for real-time transcription and voice-based interactions
- **client-sdks/** - Client libraries for different platforms and frameworks that provide type-safe interfaces to interact with Mastra services
- **examples/** - Example applications demonstrating various Mastra features including agents, workflows, memory systems, and integrations with different frameworks

## Getting Started

### Setting Up Your Development Environment

1. **Clone the repository**:

   ```bash
   git clone https://github.com/mastra-ai/mastra.git
   cd mastra
   ```

2. **Enable corepack** (ensures correct pnpm version):

   ```bash
   corepack enable
   ```

3. **Install dependencies and build initial packages**:
   ```bash
   pnpm setup
   ```
   This command installs all dependencies and builds the CLI package, which is required for other packages.

### Building Packages

- **Build all packages**:

  ```bash
  pnpm build
  ```

- **Build specific package groups**:

  ```bash
  pnpm build:packages         # All core packages
  pnpm build:deployers        # All deployment adapters
  pnpm build:combined-stores  # All vector and data stores
  pnpm build:speech           # All speech processing packages
  pnpm build:clients          # All client SDKs
  ```

- **Build individual packages**:
  ```bash
  pnpm build:core             # Core framework package
  pnpm build:cli              # CLI and playground package
  pnpm build:deployer         # Deployer package
  pnpm build:rag              # RAG package
  pnpm build:memory           # Memory package
  pnpm build:evals            # Evaluation framework package
  pnpm build:docs-mcp         # MCP documentation server
  ```

## Testing

Mastra uses Vitest for testing. To run tests:

1. **Ensure development services are running**:

   ```bash
   pnpm run dev:services:up
   ```

2. **Set up environment variables**:

   ```bash
   cp .env.example .env
   ```

   Add any necessary API keys to the `.env` file.

3. **Run tests**:
   - All tests:
     ```bash
     pnpm test
     ```
   - Specific package tests:
     ```bash
     pnpm test:core        # Core package tests
     pnpm test:cli         # CLI tests
     pnpm test:rag         # RAG tests
     pnpm test:memory      # Memory tests
     pnpm test:evals       # Evals tests
     pnpm test:clients     # Client SDK tests
     ```
   - Watch mode (for development):
     ```bash
     pnpm test:watch
     ```

## Contributing

1. **Create a branch for your changes**:

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes and ensure tests pass**:

   ```bash
   pnpm test
   ```

3. **Create a changeset** (for version management):

   ```bash
   pnpm changeset
   ```

   Follow the prompts to describe your changes.

4. **Open a pull request** with your changes.

## Documentation

The documentation site is built from the `/docs` directory. To contribute to documentation:

1. Make changes to the relevant Markdown files in the `/docs` directory
2. Test your changes locally
3. Submit a pull request with your documentation updates

## Need Help?

Join the [Mastra Discord community](https://discord.gg/BTYqqHKUrf) for support and discussions.
