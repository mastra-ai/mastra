![Chat with PDF](assets/header.png)

# Chat with PDF

An AI-powered PDF quiz generator that turns any PDF into an interactive learning experience. Index PDFs from URLs, then let the AI generate comprehension questions from the content. Uses RAG (Retrieval-Augmented Generation) to find relevant passages and create questions with page-specific hints. Built with [Mastra](https://mastra.ai).

## Why we built this

This template shows how Mastra's RAG capabilities, vector storage, and agent workflows work together: PDF ingestion with chunking, semantic search over document content, and an agent that generates educational quizzes from retrieved passages.

## Demo

https://github.com/user-attachments/assets/a3731ef5-a531-4f56-8695-8d05b7f81024

This demo runs in Mastra Studio, but you can connect this agent to your React, Next.js, or Vue app using the [Mastra Client SDK](https://mastra.ai/docs/server/mastra-client) or agentic UI libraries like [AI SDK UI](https://mastra.ai/guides/build-your-ui/ai-sdk-ui), [CopilotKit](https://mastra.ai/guides/build-your-ui/copilotkit), or [Assistant UI](https://mastra.ai/guides/build-your-ui/assistant-ui).

## Features

- ✅ PDF ingestion from any URL with automatic text extraction
- ✅ Vector-based semantic search over document content
- ✅ Quiz generation with multiple question types (multiple choice, short answer, true/false)
- ✅ Page-specific hints so users can verify answers in the source material
- ✅ Stratified sampling across page ranges for comprehensive coverage
- ✅ Multi-document support with document selection

## Prerequisites

- [OpenAI API key](https://platform.openai.com/api-keys) — used for embeddings and chat completions

## Quickstart 🚀

1. **Clone the template**
   - Run `npx create-mastra@latest --template chat-with-pdf` to scaffold the project locally.
2. **Add your API keys**
   - Copy `.env.example` to `.env` and fill in your OpenAI API key.
3. **Start the dev server**
   - Run `npm run dev` and open [localhost:4111](http://localhost:4111) to try it out.

## Making it yours

Open Studio and start chatting with the quiz agent. Provide a PDF URL to index it, then ask for a quiz on specific pages or topics. The agent searches the indexed content, generates questions from actual passages, and evaluates your answers against the source material.

Swap in a different embedding model, adjust the chunking strategy, or wire the agent into your app using the [Mastra Client SDK](https://mastra.ai/docs/server/mastra-client). The agent, tools, and workflow are all in `src/` — edit them directly to fit your use case.

## About Mastra templates

[Mastra templates](https://mastra.ai/templates) are ready-to-use projects that show off what you can build — clone one, poke around, and make it yours. They live in the [Mastra monorepo](https://github.com/mastra-ai/mastra) and are automatically synced to standalone repositories for easier cloning.

Want to contribute? See [CONTRIBUTING.md](./CONTRIBUTING.md).
