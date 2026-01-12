# Mastra Development Guide

This guide provides instructions for developers who want to contribute to or work with the Mastra codebase.

## Prerequisites

- **Node.js** (v22.13.0 or later)
- **pnpm** (v10.18.0 or later) - Mastra uses pnpm for package management
- **Docker** (for local development services) - Only needed for a subset of tests, not required for general development

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
   pnpm run setup
   ```

   This command installs all dependencies and builds the CLI package, which is required for other packages.

### Building Packages

If you run into the following error during a build:

```text
Error [ERR_WORKER_OUT_OF_MEMORY]: Worker terminated due to reaching memory limit: JS heap out of memory
```

you can increase Node’s heap size by prepending your build command with:

```bash
NODE_OPTIONS="--max-old-space-size=4096" pnpm build
```

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

## Testing Local Changes

Testing local changes to Mastra follows a simple three-step pattern:

1. Make your changes to the relevant package(s)
2. Build the packages from the monorepo root
3. Run the local CLI dev server from example/agent directory

### Step 1: Make Your Changes

Edit the source files in the relevant package. For example:

```bash
# Editing core agent functionality
vim packages/core/src/agent/agent.ts

# Editing memory system
vim packages/memory/src/index.ts

# Editing CLI/playground
vim packages/cli/src/commands/dev.ts
```

### Step 2: Build the Packages

From the monorepo root, build the packages you modified:

```bash
# Watch all packages (recommended for development)
pnpm turbo watch build

# Watch specific package for faster iteration
pnpm turbo watch build --filter="@mastra/core"        # @mastra/core
pnpm turbo watch build --filter="@mastra/cli"         # CLI and playground
pnpm turbo watch build --filter="@mastra/memory"      # @mastra/memory
pnpm turbo watch build --filter="@mastra/rag"         # @mastra/rag
pnpm turbo watch build --filter="@mastra/deployer"    # @mastra/deployer

# Watch multiple packages at once
pnpm turbo watch build --filter="@mastra/core" --filter="@mastra/cli"

# Fallback: Build everything once (if watch mode is not needed)
pnpm build
```

Using `pnpm turbo watch build` automatically rebuilds packages when you make changes, eliminating the need to manually rebuild after every modification. If you're unsure which packages depend on your changes, run `pnpm turbo watch build` without a filter to watch everything.

### Step 3: Run the Local CLI from an Example Directory

Navigate to the example directory and run the locally-built CLI:

```bash
cd examples/agent
node ../../packages/cli/dist/index.js dev
```

This starts the Mastra playground using your local packages. The playground provides an interactive UI to test agents, tools, and workflows.

> **Note:** You can also run the CLI from any existing Mastra project by using an absolute path to the CLI. For example:
>
> ```bash
> node /Users/myUser/projects/mastra/packages/cli/dist/index.js dev
> ```
>
> This approach is useful when you have a complex reproduction case in an existing project and want to test against your local changes to Mastra packages.

You may need to create an agent/tool/workflow in the example project to illustrate the bug you are trying to solve, but the changes in the example should not be committed.

### Quick Iteration Loop

Once you have the workflow set up, iteration is fast:

```bash
# 1. Start watching packages (from monorepo root in one terminal)
pnpm turbo watch build --filter="@mastra/core" --filter="@mastra/cli"

# 2. Make changes in another terminal
vim packages/core/src/agent/agent.ts

# 3. Test (from example directory)
cd examples/agent
pnpm install
node ../../packages/cli/dist/index.js dev
```

## Automated Testing

Mastra uses Vitest for testing. You can run all tests or only specific packages.

- All tests:
  ```bash
  pnpm test
  ```
- Specific package tests:
  ```bash
  pnpm test:core             # Core package tests
  pnpm test:cli              # CLI tests
  pnpm test:rag              # RAG tests
  pnpm test:memory           # Memory tests
  pnpm test:evals            # Evals tests
  pnpm test:clients          # Client SDK tests
  pnpm test:combined-stores  # Combined stores tests
  ```
- Watch mode (for development):
  ```bash
  pnpm test:watch
  ```

Some tests require environment variables to be set. If you're unsure about the required variables, ask for help in the pull request or wait for CI to run the tests.

Create a `.env` file in the root directory with the following content:

```text
OPENAI_API_KEY=
COHERE_API_KEY=
PINECONE_API_KEY=
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=
DB_URL=postgresql://postgres:postgres@localhost:5432/mastra
```

Afterwards, start the development services:

```bash
pnpm run dev:services:up
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

The documentation site is built from the `/docs` directory. Follow its [documentation guide](./docs/CONTRIBUTING.md) for instructions on contributing to the docs.

## Need Help?

Join the [Mastra Discord community](https://discord.gg/BTYqqHKUrf) for support and discussions.
