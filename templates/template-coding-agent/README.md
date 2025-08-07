# E2B Code Execution Agent

An advanced Mastra template that provides a coding agent capable of planning, writing, executing, and iterating on code in secure, isolated E2B sandboxes with comprehensive file management and development workflow capabilities.

## Overview

This template demonstrates how to build an AI coding assistant that can work with real development environments. The agent can create sandboxes, manage files and directories, execute code in multiple languages, and monitor development workflows - all within secure, isolated E2B environments.

## Features

- **Secure Code Execution**: Run Python, JavaScript, and TypeScript code in isolated E2B sandboxes
- **Complete File Management**: Create, read, write, delete files and directories with batch operations
- **Multi-Language Support**: Execute code in Python, JavaScript, and TypeScript environments
- **Live Development Monitoring**: Watch directory changes and monitor development workflows
- **Command Execution**: Run shell commands, install packages, and manage dependencies
- **Memory System**: Persistent conversation memory with semantic recall and working memory
- **Development Workflows**: Professional development patterns with build automation

## Prerequisites

- Node.js 20 or higher
- E2B API key (sign up at [e2b.dev](https://e2b.dev))
- OpenAI API key

## Setup

1. **Clone and install dependencies:**

   ```bash
   git clone <repository-url>
   cd template-coding-agent
   pnpm install
   ```

2. **Set up environment variables:**

   ```bash
   cp .env.example .env
   # Edit .env and add your API keys
   ```

   ```env
   E2B_API_KEY="your-e2b-api-key-here"
   OPENAI_API_KEY="your-openai-api-key-here"
   ```

3. **Start the development server:**

   ```bash
   pnpm run dev
   ```

## Usage

### Using the Coding Agent

The coding agent provides a conversational interface for development tasks:

```typescript
import { mastra } from './src/mastra/index';

const agent = mastra.getAgent('codingAgent');

const response = await agent.stream([
  {
    role: 'user',
    content: 'Create a Python script that analyzes CSV data and generates visualizations',
  },
]);

for await (const chunk of response.textStream) {
  console.log(chunk);
}
```

### Example Interactions

#### **Python Data Analysis Project**

```typescript
const response = await agent.stream([
  {
    role: 'user',
    content: `
      Create a complete data analysis project with:
      1. A Python script that reads CSV files
      2. Generate statistical summaries
      3. Create data visualizations with matplotlib
      4. Export results to different formats
    `,
  },
]);
```

#### **JavaScript/TypeScript Web Development**

```typescript
const response = await agent.stream([
  {
    role: 'user',
    content: `
      Set up a TypeScript project with:
      1. Proper tsconfig.json configuration
      2. A simple Express.js API server
      3. Basic middleware and routing
      4. Build and watch scripts
    `,
  },
]);
```

#### **Multi-File Project with Testing**

```typescript
const response = await agent.stream([
  {
    role: 'user',
    content: `
      Create a Python package with:
      1. Proper directory structure
      2. Core functionality modules
      3. Unit tests with pytest
      4. Requirements and setup files
      5. Documentation
    `,
  },
]);
```

## Architecture

### Core Components

#### **Coding Agent** (`src/mastra/agents/coding-agent.ts`)

The main agent with comprehensive development capabilities:

- **Sandbox Management**: Creates and manages isolated execution environments
- **Code Execution**: Runs code with real-time output capture
- **File Operations**: Complete CRUD operations for files and directories
- **Development Monitoring**: Watches for changes and monitors workflows
- **Memory Integration**: Maintains conversation context and project history

#### **E2B Tools** (`src/mastra/tools/e2b.ts`)

Complete toolkit for sandbox interaction:

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

The agent includes a sophisticated memory system:

- **Thread Management**: Automatic conversation title generation
- **Semantic Recall**: Search through previous interactions
- **Working Memory**: Maintains context across interactions
- **Vector Storage**: Semantic search capabilities with LibSQL

## Tool Categories & Usage Patterns

### **Project Planning & Structure**

1. Analyze requirements and design architecture
2. Plan directory structure and file organization
3. Create foundation with proper tooling configuration
4. Implement components incrementally with validation
5. Monitor and optimize with live development tools

### **Multi-File Project Workflow**

For complex projects requiring multiple files:

1. **Environment Setup**: Create sandbox, install dependencies
2. **Structure Creation**: Use `createDirectory` and `writeFiles` for scaffolding
3. **Live Development**: Enable `watchDirectory` for change monitoring
4. **Incremental Building**: Write, test, and validate progressively
5. **Integration Testing**: Run complete system validation

### **Language-Specific Workflows**

#### **TypeScript/JavaScript Projects**

- Initialize with `package.json` and TypeScript configuration
- Set up build processes with live compilation monitoring
- Run development servers with streaming command execution
- Manage npm installations and environment setup

#### **Python Projects**

- Set up virtual environments and dependency management
- Create proper package structure with `__init__.py` files
- Implement testing frameworks and validation
- Monitor execution and changes during development

## Development Best Practices

### **File Operations Optimization**

- Use `writeFiles` for batch operations to reduce API calls
- Check file existence before operations to prevent errors
- Monitor file sizes for large outputs or failed operations
- Implement proper directory structures for organization

### **Error Handling & Recovery**

- Validate paths and permissions before file operations
- Handle missing directories with proper creation
- Parse command error outputs for actionable feedback
- Provide clear error messages with suggested fixes

### **Security & Resource Management**

- Maintain sandbox isolation and resource limits
- Validate file paths and prevent directory traversal
- Use proper timeouts for all operations
- Monitor resource usage and prevent overconsumption

## Configuration

### Environment Variables

```bash
E2B_API_KEY=your_e2b_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
```

### Customization

You can customize the agent behavior by modifying the instructions in `src/mastra/agents/coding-agent.ts`:

```typescript
export const codingAgent = new Agent({
  name: 'Coding Agent',
  instructions: `
    // Customize agent instructions here
    // Focus on specific languages, frameworks, or development patterns
  `,
  model: openai('gpt-4.1'),
  // ... other configuration
});
```

## Advanced Features

### **Live Development Workflow**

- Set up file watchers before making changes
- Use streaming commands for long-running processes
- Monitor performance and file changes continuously
- Provide real-time feedback on build processes

### **Multi-Language Projects**

- Coordinate between different language ecosystems
- Share data and configurations between components
- Use appropriate build tools for each language
- Implement inter-process communication

### **Professional Development Patterns**

- Multi-stage build processes with dependency management
- Live reload and hot-swapping for development efficiency
- Performance profiling and optimization recommendations
- Automated testing and continuous integration workflows

## Example Projects

The agent can handle various development scenarios:

### **Data Science Project**

- Python environment setup with scientific libraries
- CSV data processing and analysis
- Statistical computations and visualizations
- Report generation and export capabilities

### **Web Application**

- TypeScript/JavaScript project setup
- Express.js or React application development
- Build configuration and development servers
- Testing and deployment preparation

### **API Development**

- RESTful API creation with proper routing
- Database integration and ORM setup
- Authentication and middleware implementation
- Documentation and testing frameworks

## Common Issues

### "E2B_API_KEY is not set"

- Make sure you've set the environment variable
- Check that your API key is valid and has sufficient credits
- Verify your E2B account is properly configured

### "Sandbox creation failed"

- Check your E2B API key and account status
- Ensure you haven't exceeded sandbox limits
- Verify network connectivity to E2B services

### "Code execution timeout"

- Increase timeout values for long-running operations
- Break down complex operations into smaller steps
- Monitor resource usage and optimize code

### "File operation errors"

- Validate file paths and permissions
- Check sandbox file system limits
- Ensure directories exist before file operations

## Development

### Project Structure

```text
src/mastra/
   agents/
      coding-agent.ts              # Main coding agent with development capabilities
   tools/
      e2b.ts                      # Complete E2B sandbox interaction toolkit
   index.ts                        # Mastra configuration with storage and logging
```

### Testing

```bash
# Start the development server
pnpm run dev

# Test with a simple code execution
curl -X POST http://localhost:4000/agents/codingAgent/generate \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Write a Python script that prints Hello World"}]}'
```

## What Makes This Template Special

### **=' Complete Development Environment**

- Full-featured coding agent with professional development capabilities
- Secure, isolated execution environments for safe code testing
- Comprehensive file management with batch operations

### **¡ Multi-Language Support**

- Python, JavaScript, and TypeScript execution
- Language-specific development workflows
- Cross-language project coordination

### **>à Intelligent Memory System**

- Persistent conversation context
- Semantic search through development history
- Working memory for maintaining project state

### **=Ê Live Development Monitoring**

- File system change monitoring
- Real-time build process feedback
- Performance tracking and optimization

### **=€ Professional Development Patterns**

- Multi-file project management
- Build automation and dependency management
- Testing frameworks and validation
- Documentation generation and project analytics

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is part of the Mastra ecosystem and follows the same licensing terms.

