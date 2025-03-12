# Create Mastra

The easiest way to get started with Mastra is by using `create-mastra`. This CLI tool enables you to quickly start building a new Mastra application, with everything set up for you.

## Usage

Using npx:

```bash
npx create-mastra@latest
```

Using npm:

```bash
npm create mastra@latest
```

Using yarn:

```bash
yarn create mastra
```

Using pnpm:

```bash
pnpm create mastra
```

## Options

- `--default` - Quick start with defaults (src directory, OpenAI, no examples)
- `-c, --components <components>` - Comma-separated list of components (agents, tools, workflows)
- `-l, --llm <model-provider>` - Default model provider (openai, anthropic, groq, or cerebras)
- `-e, --example` - Include example code

## Examples

bash:packages/create-mastra/README.md
Create a new project with default settings
npx create-mastra@latest --default
Create a project with specific components and LLM provider
npx create-mastra@latest -c agents,tools -l anthropic
Create a project with example code
npx create-mastra@latest --example

## What's included?

The generated project will have:

- A configured Mastra setup in the src directory
- Selected components (agents, tools, workflows)
- Environment configuration for your chosen LLM provider
- TypeScript configuration
- Example code (if selected)

## System Requirements

- Node.js 20 or later
- MacOS, Windows, and Linux are supported
