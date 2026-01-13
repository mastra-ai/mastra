# Code Execution Agent

An advanced Mastra template that provides a coding agent capable of planning, writing, executing, and iterating on code in secure, isolated sandbox environments with comprehensive file management and development workflow capabilities.

## Overview

This template demonstrates how to build an AI coding assistant that can work with real development environments. The agent can create sandboxes, manage files and directories, execute code in multiple languages, and monitor development workflows - all within secure, isolated sandbox environments.

## Features

- **Secure Code Execution**: Run Python, JavaScript, and TypeScript code in isolated sandboxes
- **Complete File Management**: Create, read, write, delete files and directories with batch operations
- **Multi-Language Support**: Execute code in Python, JavaScript, and TypeScript environments
- **Live Development Monitoring**: Watch directory changes and monitor development workflows
- **Command Execution**: Run shell commands, install packages, and manage dependencies
- **Memory System**: Persistent conversation memory with semantic recall and working memory
- **Development Workflows**: Professional development patterns with build automation

## Prerequisites

- Node.js 20 or higher
- API key for your chosen sandbox provider ([Daytona](https://www.daytona.io/) or [E2B](https://e2b.dev))
- API key for your chosen model provider

## Setup

1. **Clone and install dependencies:**

   ```bash
   git clone https://github.com/mastra-ai/template-coding-agent.git
   cd template-coding-agent
   pnpm install
   ```

2. **Set up environment variables:**

   ```bash
   cp .env.example .env
   # Edit .env and add your API keys
   ```

   **Choose your sandbox provider** by setting the corresponding API key:

   ```env
   # Option 1: Use Daytona (set DAYTONA_API_KEY)
   DAYTONA_API_KEY="your-daytona-api-key-here"

   # Option 2: Use E2B (set E2B_API_KEY)
   # E2B_API_KEY="your-e2b-api-key-here"


   # Model provider (required)
   OPENAI_API_KEY="your-openai-api-key-here"
   ```

   **Note:** Set only ONE sandbox provider API key. The agent will automatically use the provider you configure.

3. **Start the development server:**

   ```bash
   pnpm run dev
   ```

## Model Configuration

This template supports any AI model provider through Mastra's model router. You can use models from:

- **OpenAI**: `openai/gpt-4o-mini`, `openai/gpt-4o`
- **Anthropic**: `anthropic/claude-sonnet-4-5-20250929`, `anthropic/claude-haiku-4-5-20250929`
- **Google**: `google/gemini-2.5-pro`, `google/gemini-2.0-flash-exp`
- **Groq**: `groq/llama-3.3-70b-versatile`, `groq/llama-3.1-8b-instant`
- **Cerebras**: `cerebras/llama-3.3-70b`
- **Mistral**: `mistral/mistral-medium-2508`

Set the `MODEL` environment variable in your `.env` file to your preferred model.

## Architecture

### Core Components

#### **Coding Agent** (`src/mastra/agents/coding-agent.ts`)

The main agent with comprehensive development capabilities:

- **Sandbox Management**: Creates and manages isolated execution environments
- **Code Execution**: Runs code with real-time output capture
- **File Operations**: Complete CRUD operations for files and directories
- **Development Monitoring**: Watches for changes and monitors workflows
- **Memory Integration**: Maintains conversation context and project history

#### **Sandbox Tools** (`src/mastra/tools/`)

Complete toolkit for sandbox interaction with support for multiple providers:

**Provider Selection:**

- Automatically uses **Daytona** or **E2B** based on which API key you set

**Sandbox Management:**

- `createSandbox` - Initialize new isolated environments
- Connection management with timeout handling

**Code Execution:**

- `runCode` - Execute Python, JavaScript, TypeScript code
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
- `watchDirectory` - Live monitoring of file system changes

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

**Sandbox Provider (choose one):**

```bash
# Option 1: Daytona
DAYTONA_API_KEY=your_daytona_api_key_here

# Option 2: E2B
E2B_API_KEY=your_e2b_api_key_here

```

> [!Note]
> The agent will automatically detect and use the sandbox provider based on which API key you set.

**Model Provider (required):**

```bash
OPENAI_API_KEY=your_openai_api_key_here
```

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

### "Please set either DAYTONA_API_KEY or E2B_API_KEY environment variable"

- You need to configure a sandbox provider by setting one of the API keys
- Add either `DAYTONA_API_KEY` or `E2B_API_KEY` to your `.env` file
- Only set ONE provider API key (not both)
- Restart the development server after adding the key

### "Sandbox creation failed"

- Check your sandbox provider API key and account status
- Ensure you haven't exceeded sandbox limits for your provider
- Verify network connectivity to your sandbox provider services

### "Code execution timeout"

- Increase timeout values for long-running operations
- Break down complex operations into smaller steps
- Monitor resource usage and optimize code

### "File operation errors"

- Validate file paths and permissions
- Check sandbox file system limits
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
        index.ts                     # Provider-agnostic tool exports
        e2b.ts                       # E2B sandbox implementation
        daytona/
          tools.ts                   # Daytona sandbox implementation
          utils.ts                   # Daytona helper functions
      index.ts                       # Mastra configuration with storage and logging
```
