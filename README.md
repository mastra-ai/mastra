# Mastra

[![npm version](https://badge.fury.io/js/@mastra%2Fcore.svg)](https://www.npmjs.com/package/@mastra/core)
[![CodeQl](https://github.com/mastra-ai/mastra/actions/workflows/github-code-scanning/codeql/badge.svg)](https://github.com/mastra-ai/mastra/actions/workflows/github-code-scanning/codeql)
[![GitHub Repo stars](https://img.shields.io/github/stars/mastra-ai/mastra)](https://github.com/mastra-ai/mastra/stargazers)
[![Discord](https://img.shields.io/discord/1309558646228779139?logo=discord&label=Discord&labelColor=white&color=7289DA)](https://discord.gg/BTYqqHKUrf)
[![Twitter Follow](https://img.shields.io/twitter/follow/mastra?style=social)](https://x.com/mastra)
[![NPM Downloads](https://img.shields.io/npm/dm/%40mastra%252Fcore)](https://www.npmjs.com/package/@mastra/core)
[![Static Badge](https://img.shields.io/badge/Y%20Combinator-W25-orange)](https://www.ycombinator.com/companies?batch=W25)

Mastra is a framework for building AI-powered applications and agents with a modern TypeScript stack.

It includes everything you need to go from early prototypes to production-ready applications. Mastra integrates with frontend and backend frameworks like React, Next.js, and Node, or you can deploy it anywhere as a standalone server. It's the easiest way to build, tune, and scale reliable AI products.

## Why Mastra?

Purpose-built for TypeScript and designed around established AI patterns, Mastra gives you everything you need to build great AI applications out-of-the-box.

Some highlights include:

- [**Model routing**](https://mastra.ai/models) - Connect to 40+ providers through one standard interface. Use models from OpenAI, Anthropic, Gemini, and more.

- [**Agents**](https://mastra.ai/docs/agents/overview) - Build autonomous agents that use LLMs and tools to solve open-ended tasks. Agents reason about goals, decide which tools to use, and iterate internally until the model emits a final answer or an optional stopping condition is met.

- [**Workflows**](https://mastra.ai/docs/workflows/overview) - When you need explicit control over execution, use Mastra's graph-based workflow engine to orchestrate complex multi-step processes. Mastra workflows use an intuitive syntax for control flow (`.then()`, `.branch()`, `.parallel()`).

- [**Human-in-the-loop**](https://mastra.ai/docs/workflows/suspend-and-resume) - Suspend an agent or workflow and await user input or approval before resuming. Mastra uses [storage](https://mastra.ai/docs/server-db/storage) to remember execution state, so you can pause indefinitely and resume where you left off.

- **Context management** - Give your agents the right context at the right time. Provide [conversation history](https://mastra.ai/docs/memory/conversation-history), [retrieve](https://mastra.ai/docs/rag/overview) data from your sources (APIs, databases, files), and add human-like [working](https://mastra.ai/docs/memory/working-memory) and [semantic](https://mastra.ai/docs/memory/semantic-recall) memory so your agents behave coherently.

- **Integrations** - Bundle agents and workflows into existing React, Next.js, or Node.js apps, or ship them as standalone endpoints. When building UIs, integrate with agentic libraries like Vercel's AI SDK UI and CopilotKit to bring your AI assistant to life on the web.

- [**MCP servers**](https://mastra.ai/docs/tools-mcp/mcp-overview) - Author Model Context Protocol servers, exposing agents, tools, and other structured resources via the MCP interface. These can then be accessed by any system or agent that supports the protocol.

- **Production essentials** - Shipping reliable agents takes ongoing insight, evaluation, and iteration. With built-in [evals](https://mastra.ai/docs/evals/overview) and [observability](https://mastra.ai/docs/observability/overview), Mastra gives you the tools to observe, measure, and refine continuously.

## Get started

The **recommended** way to get started with Mastra is by running the command below:

```shell
npm create mastra@latest
```

Follow the [Installation guide](https://mastra.ai/docs/getting-started/installation) for step-by-step setup with the CLI or a manual install.

If you're new to AI agents, check out our [templates](https://mastra.ai/docs/getting-started/templates), [course](https://mastra.ai/course), and [YouTube videos](https://youtube.com/@mastra-ai) to start building with Mastra today.

## Documentation

Visit our [official documentation](https://mastra.ai/docs).

## Build with AI

Learn how to make your agent a Mastra expert by following the [Build with AI guide](https://mastra.ai/docs/getting-started/build-with-ai).

## Contributing

Looking to contribute? All types of help are appreciated, from coding to testing and feature specification. Read [CONTRIBUTING.md](./CONTRIBUTING.md) for more details on how to get involved.

If you are a developer and would like to contribute with code, please open an issue to discuss before opening a Pull Request.

Information about the project setup can be found in the [development documentation](./DEVELOPMENT.md)

## Support

We have an [open community Discord](https://discord.gg/BTYqqHKUrf). Come and say hello and let us know if you have any questions or need any help getting things running.

It's also super helpful if you leave the project a star here at the [top of the page](https://github.com/mastra-ai/mastra)

## Security

We are committed to maintaining the security of this repo and of Mastra as a whole. If you discover a security finding we ask you to please responsibly disclose this to us at [security@mastra.ai](mailto:security@mastra.ai) and we will get back to you.
