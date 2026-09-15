# Mastra Code

Mastra Code is a terminal-based AI coding agent distributed as the `mastracode` package. It combines persistent project-scoped conversations, multiple model providers, coding tools, goals, plugins, dynamic workflows, and Observational Memory so long-running work does not depend on context-window compaction.

## Installation

Mastra Code requires Node.js 22.19.0 or later. Install the CLI globally:

```bash
npm install -g mastracode
```

To use the programmatic API or build a custom TUI, install it as a project dependency instead:

```bash
npm install mastracode
```

## Usage

Start Mastra Code from the project you want it to work in:

```bash
cd your-project
mastracode
```

Or run it without a global installation:

```bash
npx mastracode
```

On first launch, the onboarding wizard connects a model provider, configures model packs and Observational Memory, and asks whether tool calls should require approval. Run `/setup` to repeat onboarding later.

## Documentation

- [Get started with Mastra Code](https://code.mastra.ai/)
- [Configure providers, storage, hooks, MCP servers, and diagnostics](https://code.mastra.ai/configuration)
- [Use Build, Plan, and Fast modes](https://code.mastra.ai/modes)
- [Run persistent goals](https://code.mastra.ai/goals)
- [Use Mastra Code in headless and CI environments](https://code.mastra.ai/headless)
- [Customize or embed Mastra Code](https://code.mastra.ai/customization)
- [Mastra Code API reference](https://code.mastra.ai/reference)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/mastracode/tui/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
