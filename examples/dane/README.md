# Hello! I'm Dane - Your AI Assistant and Friend

Hey there! I'm Dane, and I'm excited to be your AI assistant and coding companion. I've created this README to tell you all about myself and how I can help you with your projects.

## Installation

You can install me directly from npm:

```bash
npm install -g @mastra/dane@alpha
```

## What I Can Do

I'm here to make your development journey smoother and more enjoyable. Here's what I'm capable of:

- I can generate semantically correct commit messages
- I can apply labels to GitHub issues
- I can help you write and test code
- I'm great at deploying applications to the cloud
- I can assist with file system operations
- I can search the web for answers to your questions
- I can help manage your calendar
- I can read PDFs and extract information
- I can crawl websites and gather data

## Project Structure

```
src/
├── index.ts              # Main entry point
├── config/              # Configuration setup
├── commands/            # CLI commands
└── mastra/              # Core functionality
    ├── agents/          # AI agents definitions
    ├── integrations/    # External service integrations
    ├── tools/           # Utility tools
    └── workflows/       # Workflow definitions
```

## Features

- **Interactive CLI Interface**: I provide a friendly command-line interface with colored output using chalk
- **GitHub Integration**: I can help with automated issue labeling
- **GitHub Integration**: I can help with generating commit messages
- **FireCrawl Integration**: I can crawl websites and gather data
- **Tool: PDF Reader**: I can read PDFs and extract information
- **Tool: Calendar**: I can help with managing your calendar
- **Tool: Web Search**: I can search the web for answers to your questions
- **Tool: File System**: I can help with file system operations (read, write, append)
- **Workflow System**: I use a modular workflow system to execute various tasks
- **Mastra Framework**: I leverage a core framework with agents, integrations, and tools

## Getting Started

To start working with me:

Make sure you have a local postgres database running at `5433:5432` with the database name `mastra`.

```bash
# Setup config keys (one time setup)
dane config --set ANTHROPIC_API_KEY=<your-key>
```

```bash
# Run the main application
dane

# Run the issue labeler
dane issue-labeler
```

```bash
# Run the commit message generator
dane commit
```

## Environment Variables

For the issue labeler, I need these environment variables:

- `ISSUE_NUMBER`: The GitHub issue number to label
- `OWNER`: The repository owner
- `REPO`: The repository name

## Workflows

I currently support two main workflows:

1. `message` - General message processing workflow
2. `githubIssueLabeler` - Automated GitHub issue labeling workflow

## Contributing

I love collaborating with humans! Feel free to contribute to this project by submitting issues or pull requests. I'm always excited to see how we can make things better together.

---

_This README was written by Dane, your AI assistant and friend. I'm here to help you succeed in your development journey!_
