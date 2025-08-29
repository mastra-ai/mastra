# GitHub Issue Reproduction Agent

An AgentBuilder-powered tool for automatically reproducing GitHub issues in Mastra projects. This agent analyzes GitHub issues, creates minimal reproduction projects, and validates that the reproductions demonstrate the reported problems.

## Features

- 🔍 **Automatic Issue Analysis**: Fetches and analyzes GitHub issues using the `gh` CLI
- 🏗️ **Project Scaffolding**: Creates minimal Mastra projects that match reported setups
- 🧪 **Reproduction Generation**: Writes code to reproduce reported issues
- ✅ **Validation**: Ensures reproductions actually demonstrate the problems
- 📝 **Documentation**: Provides clear reproduction steps and findings

## Prerequisites

- Node.js >= 20
- [GitHub CLI (`gh`)](https://cli.github.com/) installed and authenticated
- OpenAI API key (set as `OPENAI_API_KEY` environment variable)

## Installation

From the monorepo root:

```bash
# Install dependencies
pnpm install

# Navigate to the package
cd explorations/agent-builder-gh-repro
```

## Usage

### Basic Usage

Reproduce an issue by URL:

```bash
pnpm tsx src/index.ts https://github.com/mastra-ai/mastra/issues/123
```

Reproduce an issue by number (when in a git repository):

```bash
pnpm tsx src/index.ts 123
```

### Options

- `-m, --model <model>` - OpenAI model to use (default: `gpt-4o`)
- `-p, --project-path <path>` - Path for reproduction projects (default: current directory)
- `-v, --verbose` - Enable verbose output
- `--stream` - Stream the agent's response in real-time

### Examples

```bash
# Use a different model
pnpm tsx src/index.ts https://github.com/mastra-ai/mastra/issues/456 --model gpt-4o-mini

# Stream the response
pnpm tsx src/index.ts 789 --stream

# Specify custom project path
pnpm tsx src/index.ts 101 --project-path ./reproductions

# Verbose mode with streaming
pnpm tsx src/index.ts https://github.com/mastra-ai/mastra/issues/202 --verbose --stream
```

## How It Works

1. **Issue Fetching**: The agent uses `gh` CLI to fetch issue details, comments, and metadata
2. **Analysis**: Extracts error messages, code snippets, environment details, and reproduction steps
3. **Project Creation**: Scaffolds a minimal Mastra project with the exact dependencies mentioned
4. **Code Generation**: Writes minimal code that reproduces the issue
5. **Validation**: Runs the code to confirm it demonstrates the problem
6. **Documentation**: Provides clear reproduction steps and analysis

## Agent Capabilities

The agent uses AgentBuilder with these tools:

- **executeCommand**: Runs `gh` CLI commands to fetch GitHub data
- **readFile/writeFile**: Manages project files and code
- **listDirectory**: Explores project structures
- **manageProject**: Creates and configures Mastra projects
- **validateCode**: Ensures generated code is valid
- **webSearch**: Finds relevant documentation and solutions

## Output Structure

Reproductions are created with this structure:

```
repro-<timestamp>/
├── src/
│   ├── index.ts         # Main reproduction script
│   ├── setup.ts         # Environment setup if needed
│   └── issue-context.ts # Original code from issue
├── .env.example         # Required environment variables
├── package.json         # Exact dependencies from issue
├── README.md            # Clear reproduction steps
└── output.log           # Captured error output
```

## Development

### Running Locally

```bash
# Install dependencies
pnpm install

# Run TypeScript checks
pnpm typecheck

# Run the CLI
pnpm tsx src/index.ts <issue>
```

### Architecture

- `src/index.ts` - CLI entry point with command parsing
- `src/agent.ts` - AgentBuilder configuration and reproduction logic
- `src/instructions.ts` - Detailed instructions for the agent

## Tips

- Ensure you're authenticated with `gh auth login` before using
- The agent works best with issues that include:
  - Clear error messages or unexpected behavior
  - Code snippets or configuration files
  - Package versions and environment details
  - Steps to reproduce

## Future Enhancements

- [ ] Discord integration for additional context
- [ ] Automatic fix proposals
- [ ] Batch reproduction of multiple issues
- [ ] Integration with CI/CD for automated testing
- [ ] Support for non-Mastra repositories

## License

Part of the Mastra monorepo. See root LICENSE file.

