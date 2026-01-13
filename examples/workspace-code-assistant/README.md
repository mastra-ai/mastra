# Workspace Code Assistant

An example agent with full workspace capabilities for file operations and code execution.

## What This Demonstrates

This example shows how to create an agent with a **Workspace** that can:

- 📁 **Read/Write Files** - Create, read, update, and delete files
- 📂 **List Directories** - Browse the workspace filesystem
- 🚀 **Execute Code** - Run Node.js, Python, and shell scripts
- 💻 **Run Commands** - Execute shell commands like `npm`, `pip`, etc.

## How It Works

When you configure a `workspace` on an agent, Mastra automatically injects these tools:

| Tool | Description |
|------|-------------|
| `workspace_read_file` | Read file contents |
| `workspace_write_file` | Write content to a file |
| `workspace_list_files` | List files in a directory |
| `workspace_delete_file` | Delete a file |
| `workspace_file_exists` | Check if path exists |
| `workspace_mkdir` | Create a directory |
| `workspace_execute_code` | Execute code (Node, Python, shell) |
| `workspace_execute_command` | Run shell commands |
| `workspace_install_package` | Install packages |

## Setup

```bash
# Install dependencies
pnpm install

# Set your OpenAI API key
export OPENAI_API_KEY=your-key-here
```

## Run the Demo

```bash
pnpm demo
```

The demo will:
1. Create a Python "Hello World" script and run it
2. Create a Node.js factorial function and test it
3. List all files and show contents
4. Create buggy code, run it, and fix it

## Code Structure

```
src/
├── index.ts                    # Demo script
└── mastra/
    ├── index.ts                # Mastra setup
    └── agents/
        └── index.ts            # Code assistant agent with workspace
```

## Key Code

### Creating the Workspace

```typescript
import { Workspace, LocalFilesystem, LocalSandbox } from '@mastra/core/workspace';

const workspace = new Workspace({
  filesystem: new LocalFilesystem({
    basePath: './workspace-files',
  }),
  sandbox: new LocalSandbox({
    workingDirectory: './workspace-files',
  }),
});
```

### Creating the Agent

```typescript
import { Agent } from '@mastra/core/agent';

const codeAssistant = new Agent({
  id: 'code-assistant',
  name: 'Code Assistant',
  model: openai('gpt-4o'),
  instructions: 'You are a helpful coding assistant...',
  workspace,  // <-- Tools are auto-injected!
});
```

### Using the Agent

```typescript
// Initialize workspace first
await workspace.init();

// Agent can now read/write files and execute code
const response = await codeAssistant.generate(
  'Create a Python script that prints Hello World and run it'
);

// Cleanup when done
await workspace.destroy();
```

## Example Prompts

Try these with the code assistant:

- "Create a Python script that calculates prime numbers up to 100"
- "Write a Node.js function to parse JSON files and test it"
- "List all files and show me any Python files"
- "Create a shell script that shows system info"
- "Read the hello.py file and add comments to it"

## Notes

- **LocalSandbox** runs code on your machine - only use for development
- Files are stored in `./workspace-files/` directory
- For production, use cloud sandboxes (E2B, Modal, etc.)
