# Flash Cards from PDF

A template that generates educational flash cards from PDF documents. Attach a PDF in Mastra Studio, and the agent creates flash cards with optional AI-generated images. Built with [Mastra](https://mastra.ai).

## Why we built this

This template shows how you can generate images with an agent, and how to build a tool that parses PDFs.

## Demo

This demo runs in Mastra Studio, but you can connect this workflow to your React, Next.js, or Vue app using the [Mastra Client SDK](https://mastra.ai/docs/server/mastra-client) or agentic UI libraries like [AI SDK UI](https://mastra.ai/guides/build-your-ui/ai-sdk-ui), [CopilotKit](https://mastra.ai/guides/build-your-ui/copilotkit), or [Assistant UI](https://mastra.ai/guides/build-your-ui/assistant-ui).

## Features

- Self-evaluating research loops that identify gaps and keep searching
- Human-in-the-loop with suspend/resume for clarifying questions
- Multiple specialized agents coordinating on a single task
- Web search and page scraping via Exa
- Sourced answers with citations

## Prerequisites

- [OpenAI API key](https://platform.openai.com/api-keys) — used by default, but you can swap in any model

## Quickstart 🚀

1. **Clone the template**
   - Run `npx create-mastra@latest --template flash-cards-from-pdf` to scaffold the project locally.
2. **Add your API keys**
   - Copy `.env.example` to `.env` and fill in your keys.
3. **Start the dev server**
   - Run `npm run dev` and open [localhost:4111](http://localhost:4111) to try it out.

## Making it yours

Select the **Flash Card Agent** and attach a PDF file using the attachment button in the chat. You can use the `assets/example.pdf` file included in the repo for testing. Ask the agent: "Create flash cards from this PDF". Optionally, afterwards ask for images: "Generate flash cards with images for the key concepts".

Swap in a different image generation provider, add your instructions, or wire the agent into your app using the [Mastra Client SDK](https://mastra.ai/docs/server/mastra-client). The agent is in `src/agents` — edit it directly to fit your use case.

## About Mastra templates

[Mastra templates](https://mastra.ai/templates) are ready-to-use projects that show off what you can build — clone one, poke around, and make it yours. They live in the [Mastra monorepo](https://github.com/mastra-ai/mastra) and are automatically synced to standalone repositories for easier cloning.

Want to contribute? See [CONTRIBUTING.md](./CONTRIBUTING.md).
