---
sidebar_position: 1
title: Introduction
description: Mastra is a TypeScript agent framework. It helps you build AI applications and features quickly. It gives you the set of primitives you need - workflows, agents, RAG, integrations, syncs and evals.
---

# About Mastra

Mastra is an open-source TypeScript agent framework.

It's designed to give you the primitives you need to build AI applications and features.

You can use Mastra to build [AI agents](./agents/overview.md) that have memory and can execute functions, or chain LLM calls in deterministic [workflows](./workflows/overview.md). You can chat with your agents in Mastra's local dev playground, feed them application-specific knowledge with RAG, and score their outputs with Mastra's evals.

The main features include:

- **[Model routing](https://sdk.vercel.ai/docs/introduction)**: Mastra uses the [Vercel AI SDK](https://sdk.vercel.ai/docs/introduction) for model routing, providing a unified interface to interact with any LLM provider including OpenAI, Anthropic, and Google Gemini.
- **Agent memory and tool calling**: With Mastra, you can give your agent tools (functions) that it can call. You can persist agent memory and retrieve it based on recency, semantic similarity, or conversation thread.
- **Workflow graphs**: When you want to execute LLM calls in a deterministic way, Mastra gives you a graph-based workflow engine. You can define discrete steps, log inputs and outputs at each step of each run, and pipe them into an observability tool. Mastra workflows have a simple syntax for control flow (`.then()`, `.branch()`, `.parallel()`) that allows branching and chaining.
- **Agent development playground**: When you're developing an agent locally, you can chat with it and see its state and memory in Mastra's agent development environment.
- **Retrieval-augmented generation (RAG)**: Mastra gives you APIs to process documents (text, HTML, Markdown, JSON) into chunks, create embeddings, and store them in a vector database. At query time, it retrieves relevant chunks to ground LLM responses in your data, with a unified API on top of multiple vector stores (Pinecone, pgvector, etc) and embedding providers (OpenAI, Cohere, etc).
- **Deployment**: Mastra supports bundling your agents and workflows within an existing React, Next.js, or Node.js application, or into standalone endpoints. The Mastra deploy helper lets you easily bundle agents and workflows into a Node.js server using Hono, or deploy it onto a serverless platform like Vercel, Cloudflare Workers, or Netlify.
- **Evals**: Mastra provides automated evaluation metrics that use model-graded, rule-based, and statistical methods to assess LLM outputs, with built-in metrics for toxicity, bias, relevance, and factual accuracy. You can also define your own evals.
- **Observability**: Mastra provides specialized AI tracing to monitor LLM operations, agent decisions, and tool executions. Track token usage, latency, and conversation flows with native exporters for Langfuse, Braintrust, and Mastra Cloud. Structured logging provides additional debugging capabilities for comprehensive monitoring.
