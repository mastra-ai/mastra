# Runloop Sandboxed Agent

An advanced Mastra template that provides a coding agent capable of planning, writing, executing, and iterating on code in secure, isolated Runloop devboxes with comprehensive file management and development workflow capabilities.

## Overview

This template demonstrates how to build an AI coding assistant that can work with real development environments. The agent can create devboxes, manage files and directories, execute code in multiple languages, and monitor development workflows - all within secure, isolated Runloop devboxes.

## Features

- **Secure Code Execution**: Run Python, JavaScript, and TypeScript code in isolated Runloop devboxes using direct execution via `python -c` and `node -e`
- **Complete File Management**: Create, read, write, delete files and directories with batch operations
- **Multi-Language Support**: Execute code in Python, JavaScript, and TypeScript environments
- **Live Development Monitoring**: Monitor directory changes via polling and track development workflows
- **Command Execution**: Run shell commands, install packages, and manage dependencies
- **Memory System**: Persistent conversation memory with semantic recall and working memory
- **Development Workflows**: Professional development patterns with build automation

## Prerequisites

- Node.js 20 or higher
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
RUNLOOP_BLUEPRINT_NAME=runloop/mastra-base  # Optional: specify a blueprint for faster devbox creation
```

#### Blueprint Configuration

Blueprints are pre-configured environments that speed up devbox creation. Set `RUNLOOP_BLUEPRINT_NAME` to use a specific blueprint when creating devboxes. This is optional but recommended for faster startup times.

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
