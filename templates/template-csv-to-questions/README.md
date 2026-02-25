# CSV to Questions Generator

An agent that takes a CSV file as input, generates an AI summary to compress the data, and then produces focused questions based on that summary. Built with [Mastra](https://mastra.ai).

## Why we built this

This template demonstrates how to handle large datasets without hitting token limits by using a large context window model as a summarization layer before question generation.

This template shows how to combine agents into a workflow that can process large CSV files, generate summaries, and produce questions—all while keeping token usage efficient and costs down.

## Demo

TODO

This demo runs in Mastra Studio, but you can connect this agent to your React, Next.js, or Vue app using the [Mastra Client SDK](https://mastra.ai/docs/server/mastra-client) or agentic UI libraries like [AI SDK UI](https://mastra.ai/guides/build-your-ui/ai-sdk-ui), [CopilotKit](https://mastra.ai/guides/build-your-ui/copilotkit), or [Assistant UI](https://mastra.ai/guides/build-your-ui/assistant-ui).

## Features

- **Token Limit Protection**: Uses AI summarization to compress large CSV datasets, preventing token limit errors and reducing costs.
- **Large Context Window**: Leverages `openai/gpt-5-mini` to handle large datasets efficiently.
- **Data Analysis Focus**: Generates questions focused on patterns, insights, and practical applications of the data.

## Quick start

1. **Clone the template**
   - Run `npx create-mastra@latest --template csv-to-questions` to scaffold the project locally.
2. **Add your API key**
   - Copy `.env.example` to `.env` and fill in your OpenAI API key.
3. **Start the dev server**
   - Run `npm run dev` and open [localhost:4111](http://localhost:4111) to try it out.

Open Studio and navigate to the `csv-to-questions` workflow. Enter a CSV URL and the workflow will generate questions based on the content.

**Need a CSV to try?** Grab this world GDP dataset: `https://raw.githubusercontent.com/plotly/datasets/master/2014_world_gdp_with_codes.csv`

## Making it yours

Swap in a different embedding model, or wire the agent into your app using the [Mastra Client SDK](https://mastra.ai/docs/server/mastra-client). The agent, tools, and workflow are all in `src/` — edit them directly to fit your use case.

## About Mastra templates

[Mastra templates](https://mastra.ai/templates) are ready-to-use projects that show off what you can build — clone one, poke around, and make it yours. They live in the [Mastra monorepo](https://github.com/mastra-ai/mastra) and are automatically synced to standalone repositories for easier cloning.

Want to contribute? See [CONTRIBUTING.md](./CONTRIBUTING.md).
