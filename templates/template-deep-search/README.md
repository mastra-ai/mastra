![Deep Search](assets/header.png)

# Deep Search

An AI research assistant that evaluates its own work. It searches, checks if the results actually answer your question, identifies what's missing, and keeps going until it gets there. Uses [Exa](https://exa.ai) for web search and page scraping. Inspired by OpenAI's deep research and Perplexity. Built with [Mastra](https://mastra.ai).

## Why we built this

This template shows how Mastra's workflow primitives and agent orchestration come together: nested workflows, suspend/resume for human input, and multiple specialized agents coordinating on a single task.

## Demo

https://github.com/user-attachments/assets/dfea59c3-8038-461c-a4b4-504f8fc01575

This demo runs in Mastra Studio, but you can connect this workflow to your React, Next.js, or Vue app using the [Mastra Client SDK](https://mastra.ai/docs/server/mastra-client) or agentic UI libraries like [AI SDK UI](https://mastra.ai/guides/build-your-ui/ai-sdk-ui), [CopilotKit](https://mastra.ai/guides/build-your-ui/copilotkit), or [Assistant UI](https://mastra.ai/guides/build-your-ui/assistant-ui).

## Features

- Self-evaluating research loops that identify gaps and keep searching
- Human-in-the-loop with suspend/resume for clarifying questions
- Multiple specialized agents coordinating on a single task
- Web search and page scraping via Exa
- Sourced answers with citations

## Prerequisites

- [OpenAI API key](https://platform.openai.com/api-keys) — used by default, but you can swap in any model
- [Exa API key](https://dashboard.exa.ai/api-keys) — for web search and page scraping

## Quickstart 🚀

1. **Clone the template**
   - Run `npx create-mastra@latest --template deep-search` to scaffold the project locally.
2. **Add your API keys**
   - Copy `.env.example` to `.env` and fill in your keys.
3. **Start the dev server**
   - Run `npm run dev` and open [localhost:4111](http://localhost:4111) to try it out.

## Making it yours

Open Studio and trigger the `deep-search` workflow with your research question. The workflow asks a few clarifying questions — answer them and resume. Watch the console as it searches, evaluates, and iterates until you get a sourced answer.

Swap in a different search provider, add your own evaluation criteria, or wire the workflow into your app using the [Mastra Client SDK](https://mastra.ai/docs/server/mastra-client). The agents and workflow steps are all in `src/` — edit them directly to fit your use case.

## About Mastra templates

[Mastra templates](https://mastra.ai/templates) are ready-to-use projects that show off what you can build — clone one, poke around, and make it yours. They live in the [Mastra monorepo](https://github.com/mastra-ai/mastra) and are automatically synced to standalone repositories for easier cloning.

Want to contribute? See [CONTRIBUTING.md](./CONTRIBUTING.md).
