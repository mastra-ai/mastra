# Customer Feedback Summarization

An AI agent that analyzes customer feedback and produces actionable summaries. It retrieves feedback, categorizes it by type and sentiment, identifies critical issues, and generates executive-level reports with concrete recommendations. It uses Observational Memory to learn your preferences and track trends across sessions.

## Why we built this

This template shows how an AI agent can do that analysis conversationally: ask it to summarize all feedback, drill into enterprise complaints, or compare this month's themes to last month's. The agent remembers context across sessions, so it gets more useful over time.

## Demo

https://github.com/user-attachments/assets/214aad12-f8bc-4eae-bcf0-2df5d809e3f5

This demo runs in Mastra Studio, but you can connect this agent to your React, Next.js, or Vue app using the [Mastra Client SDK](https://mastra.ai/docs/server/mastra-client) or agentic UI libraries like [AI SDK UI](https://mastra.ai/guides/build-your-ui/ai-sdk-ui), [CopilotKit](https://mastra.ai/guides/build-your-ui/copilotkit), or [Assistant UI](https://mastra.ai/guides/build-your-ui/assistant-ui).

## Quick start

```bash
npx create-mastra@latest --template customer-feedback-summarization
cd customer-feedback-summarization
```

Create a `.env` file:

```bash
OPENAI_API_KEY=your-api-key
```

Run it:

```bash
npm run dev
```

This starts Mastra Studio at [localhost:4111](http://localhost:4111).

## Using it

1. Open Studio and navigate to the "Customer Feedback Summarizer" agent
2. Ask it questions like:
   - "Summarize all customer feedback"
   - "What are the critical issues from enterprise customers?"
   - "Show me only the feature requests from pro users"
   - "Compare support tickets to app reviews"
3. The agent fetches feedback using the `get-feedback` tool (with pagination), analyzes it, and generates a structured summary with findings and recommendations.
4. Paste new feedback directly into the chat. The agent incorporates it into its analysis.
5. Across sessions, Observational Memory tracks patterns so the agent can identify trends over time.

### Connecting to real data

The `get-feedback` tool reads from a static fixture file. To connect it to a real data source, update the `execute` function in `src/mastra/tools/get-feedback.ts` to query your database or API. The tool's pagination interface (`limit`, `offset`, `has_more`) is designed to map directly to standard database query patterns.

## About Mastra templates

[Mastra templates](https://mastra.ai/templates) are ready-to-use projects that show off what you can build -- clone one, poke around, and make it yours. They live in the [Mastra monorepo](https://github.com/mastra-ai/mastra) and are automatically synced to standalone repositories for easier cloning.

Want to contribute? See [CONTRIBUTING.md](./CONTRIBUTING.md).
