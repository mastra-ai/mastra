# Re-ranking Results with Tools

A practical example demonstrating how to use Mastra's vector query tool to re-rank results. This example shows how to use the tool with OpenAI embeddings and PGVector for vector storage and semantic search.

## Prerequisites

- Node.js v20.0+
- pnpm (recommended) or npm
- OpenAI API key
- Postgres connection string

## Getting Started

1. Clone the repository and navigate to the project directory:

```bash
git clone https://github.com/mastra-ai/mastra
cd examples/basics/rag/rerank-rag
```

2. Copy the environment variables file and add your OpenAI API key:

```bash
cp .env.example .env
```

Then edit `.env` and add your OpenAI API key:

```env
OPENAI_API_KEY=sk-your-api-key-here
POSTGRES_CONNECTION_STRING=your-postgres-connection-string-here
```

3. Install dependencies:

```bash
pnpm install
```

4. Run the example:

```bash
pnpm start
```
