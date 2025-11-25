# Runloop Sandboxed Agent

A Mastra template that provides a sandboxed agent capable of planning, writing, executing, and iterating on code in secure, isolated Runloop devboxes with file management and development workflow capabilities.

## Overview

This template demonstrates how to build an AI assistant that can work with real development environments. The agent can create devboxes, manage files and directories, execute code in multiple languages, interact with browser, interact with the computer, and monitor development workflows - all within secure, isolated Runloop devboxes.

## Architecture: Local Agent + Cloud Execution

This template uses a **hybrid architecture** that combines local development with cloud-based code execution:

- **Local Component**: The Mastra agent runs locally on your machine. You start it with `pnpm run dev`, which launches the Mastra development server (typically at `http://localhost:4111/`). The agent logic, memory system, and tool orchestration all run locally.

- **Cloud Component**: Code execution happens in cloud-based Runloop devboxes. When the agent needs to execute code, manage files, or run commands, it creates and manages isolated Runloop devboxes via the Runloop API. These devboxes provide secure, isolated environments for code execution.

This architecture provides the best of both worlds: fast local development and iteration, combined with secure, scalable cloud execution environments.

## Features

- **Secure Code Execution**: Run any code in isolated Runloop devboxes using direct execution. Native execution with `python -c` and `node -e` are availabe as tools and the agent has direct access to shell for other languages.
- **Complete File Management**: Create, read, write, delete files and directories with batch operations
- **Multi-Language Support**: Execute code with Python, JavaScript, and TypeScript natively; install any other environments to the isolated sandbox.
- **Live Development Monitoring**: Monitor directory changes via polling and track development workflows.
- **Command Execution**: Run shell commands, install packages, and manage dependencies.
- **Memory System**: Persistent conversation memory with semantic recall and working memory.
- **Development Workflows**: Professional development patterns with build automation.

## Prerequisites

- Node.js 22.13.0 or higher
- pnpm (package manager)
- Runloop API key (sign up at [platform.runloop.ai](https://platform.runloop.ai))
- OpenAI API key

## Setup

1. **Clone and install dependencies:**

   ```bash
   git clone https://github.com/mastra-ai/template-sandboxed-agent.git
   cd template-sandboxed-agent
   pnpm install
   ```

2. **Set up environment variables:**

   ```bash
   cp .env.example .env
   # Edit .env and add your API keys
   ```

   ```env
   RUNLOOP_API_KEY="your-runloop-api-key-here"
   OPENAI_API_KEY="your-openai-api-key-here"
   # Optional: specify a different blueprint with mastra dependencies available
   RUNLOOP_BLUEPRINT_NAME="runloop/mastra-base"
   ```

3. **Start the development server:**

   ```bash
   pnpm run dev
   ```

   This starts the Mastra development server locally. You can access:
   - **Mastra Studio UI**: `http://localhost:4111/` (interactive agent interface)
   - **REST API**: `http://localhost:4111/swagger-ui` (API documentation)

4. **Verify installation:**

   ```bash
   # Check TypeScript types
   pnpm run type-check

   # Run linting
   pnpm run lint
   ```

## Architecture

### Core Components

#### **Coding Agent** (`src/mastra/agents/coding-agent.ts`)

The main agent with comprehensive development capabilities:

- **Devbox Management**: Creates and manages isolated execution environments
- **Code Execution**: Runs code with real-time output capture
- **File Operations**: Complete CRUD operations for files and directories
- **Development Monitoring**: Watches for changes and monitors workflows
- **Memory Integration**: Maintains conversation context and project history

#### **Runloop Tools** (`src/mastra/tools/runloop.ts`)

Complete toolkit for devbox interaction:

**Devbox Management:**

- `createSandbox` - Initialize new isolated environments (supports blueprint via `RUNLOOP_BLUEPRINT_NAME` env var)
- Connection management with devbox ID

**Code Execution:**

- `runCode` - Execute Python, JavaScript, TypeScript code using direct execution (`python -c`, `node -e`, `ts-node -e`)
- Real-time output capture and error handling
- Environment variable and timeout configuration

**File Operations:**

- `writeFile` - Create individual files
- `writeFiles` - Batch create multiple files for project setup
- `readFile` - Read file contents for analysis and validation
- `listFiles` - Explore directory structures
- `deleteFile` - Clean up files and directories
- `createDirectory` - Set up project structures

**File Information & Monitoring:**

- `getFileInfo` - Get detailed file metadata
- `checkFileExists` - Validate file existence for conditional logic
- `getFileSize` - Monitor file sizes and track changes
- `watchDirectory` - Polling-based monitoring of file system changes (native watching not available)

**Development Workflow:**

- `runCommand` - Execute shell commands, build scripts, package management

### Memory System

The agent includes a configured memory system:

- **Thread Management**: Automatic conversation title generation
- **Semantic Recall**: Search through previous interactions
- **Working Memory**: Maintains context across interactions
- **Vector Storage**: Semantic search capabilities with `LibSQLVector`

## Configuration

### Environment Variables

```bash
RUNLOOP_API_KEY=your_runloop_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
RUNLOOP_BLUEPRINT_NAME=runloop/mastra-base  # Optional: specify a specific blueprint; runloop/mastra-base has the latest version of Mastra available
```

#### Blueprint Configuration

Blueprints are pre-configured environments that speed up devbox creation. Set `RUNLOOP_BLUEPRINT_NAME` to use a specific blueprint when creating devboxes. `runloop/mastra-base` has Mastra installed in addition to the base environment.

### Customization

You can customize the agent behavior by modifying the instructions in `src/mastra/agents/coding-agent.ts`:

```typescript
export const codingAgent = new Agent({
  id: 'coding-agent',
  name: 'Coding Agent',
  instructions: `
    // Customize agent instructions here
    // Focus on specific languages, frameworks, or development patterns
  `,
  model: openai('gpt-4.1'),
  // ... other configuration
});
```

## Common Issues

### "RUNLOOP_API_KEY is not set"

- Make sure you've set the environment variable
- Check that your API key is valid and has sufficient credits
- Verify your Runloop account is properly configured

### "Devbox creation failed"

- Check your Runloop API key and account status
- Ensure you haven't exceeded devbox limits
- Verify network connectivity to Runloop services
- If using a blueprint, verify the blueprint name is correct

### "Code execution timeout"

- Increase timeout values for long-running operations
- Break down complex operations into smaller steps
- Monitor resource usage and optimize code

### "File operation errors"

- Validate file paths and permissions
- Check devbox file system limits
- Ensure directories exist before file operations

### "Agent stopping with tool-call reason"

- Increase `maxSteps` in the agent configuration

### "TypeScript or linting errors"

- Run `pnpm run type-check` to see TypeScript errors
- Run `pnpm run lint` to see linting issues
- Ensure all dependencies are installed: `pnpm install`
- Check that your Node.js version meets the requirement (22.13.0+)

### "Connection issues with Runloop API"

- Verify your `RUNLOOP_API_KEY` is set correctly
- Check your network connectivity
- Ensure your Runloop account has sufficient credits
- Verify the Runloop API endpoint is accessible from your deployment environment

## Deployment

### Local Development

The template is designed to run locally for development and testing:

1. **Development Mode**: Use `pnpm run dev` to start the Mastra development server with hot-reload
2. **Production Build**: Use `pnpm run build` to create an optimized production build
3. **Production Start**: Use `pnpm run start` to run the production build

The agent runs locally but connects to Runloop cloud services for code execution. All agent logic, memory, and orchestration happen on your local machine.

### Cloud Deployment

To deploy this template to cloud environments (e.g., AWS, GCP, Azure, Vercel, Railway):

1. **Build the application:**

   ```bash
   pnpm run build
   ```

2. **Set environment variables** in your cloud platform:
   - `RUNLOOP_API_KEY` - Your Runloop API key
   - `OPENAI_API_KEY` - Your OpenAI API key
   - `RUNLOOP_BLUEPRINT_NAME` - (Optional) Blueprint name for devboxes
   - `NODE_ENV=production` - Set to production mode

3. **Deploy the built application** using your platform's deployment process

4. **Configure the Mastra server** to listen on the appropriate host and port:
   - The Mastra server will start automatically when the application runs
   - Ensure your cloud platform exposes the port Mastra uses (default: 4111)
   - Configure reverse proxy/load balancer if needed

5. **Access the deployed service:**
   - Mastra Studio UI: `https://your-domain.com/`
   - REST API: `https://your-domain.com/swagger-ui`

**Note**: The architecture remains the same in cloud deployments - the Mastra agent runs in your cloud environment and connects to Runloop devboxes for code execution. This provides consistent behavior between local and cloud deployments.

### Platform-Specific Notes

- **Vercel/Railway/Netlify**: These platforms work well with Node.js applications. Ensure you set all required environment variables.
- **Docker**: You can containerize the application. The `mastra start` command will start the production server.
- **Kubernetes**: Deploy as a standard Node.js application with proper resource limits and health checks.

## Development

### Project Structure

```text
src/mastra/
      agents/
        coding-agent.ts              # Main coding agent with development capabilities
      tools/
        runloop.ts                   # Complete Runloop devbox interaction toolkit
      index.ts                        # Mastra configuration with storage and logging
```

### Available Scripts

- `pnpm run dev` - Start development server with hot-reload
- `pnpm run build` - Build for production
- `pnpm run start` - Start production server
- `pnpm run lint` - Run ESLint to check code quality
- `pnpm run type-check` - Run TypeScript type checking without emitting files
