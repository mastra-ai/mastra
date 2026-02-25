# Mastra Development Guide

This guide provides instructions for developers who want to contribute to or work with the Mastra codebase.

## Prerequisites

- **Node.js** (v22.13.0 or later)
- **pnpm** (v10.18.0 or later) - Mastra uses pnpm for package management
- **Docker** (for local development services) - Only needed for a subset of tests, not required for general development

## Getting started

### Setting up your development environment

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

### Building packages

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

## Testing local changes

Testing local changes to Mastra follows a simple three-step pattern:

1. Make your changes to the relevant package(s)
2. Build the packages
3. Test your changes inside the `examples/agent` project

### Step 1: Make your changes

Edit the necessary source files. Take note of the affected packages so that you can filter by them in the next step.

### Step 2: Build the packages

From the monorepo root, build the packages you modified:

```bash
# Watch a specific package for faster iteration
pnpm turbo watch build --filter="@mastra/core"

# Watch multiple packages at once
pnpm turbo watch build --filter="@mastra/core" --filter="mastra"

# Watch all packages (not recommended, use --filter instead)
pnpm turbo watch build

# Fallback: Build everything once (if watch mode is not needed)
pnpm build
```

Using `pnpm turbo watch build` automatically rebuilds packages when you make changes, eliminating the need to manually rebuild after every modification. If you're unsure which packages depend on your changes, run `pnpm turbo watch build` without a filter to watch everything.

### Step 3: Test your changes

Open a new terminal window and navigate to `examples/agent`. Install its dependencies:

```bash
cd examples/agent
pnpm install --ignore-workspace
```

It's important that you use `--ignore-workspace` as otherwise the dependencies won't be installed correctly.

Afterwards you can start the Mastra development server:

```shell
pnpm mastra:dev
```

Whenever you make changes to the source code, the `turbo watch` process from step 2 will rebuild the packages. You then can restart the development server to see your changes.

## Testing

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

The documentation site is built from the `docs/` directory. Follow its [documentation guide](./docs/CONTRIBUTING.md) for instructions on contributing to the docs.

## Need help?

Join the [Mastra Discord community](https://discord.gg/BTYqqHKUrf) for support and discussions.
