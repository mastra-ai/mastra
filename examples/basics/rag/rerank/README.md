# Re-ranking Results

A simple example showing how to do result re-ranking with RAG using Mastra, OpenAI, and PGVector.

## Prerequisites

- Node.js v20.0+
- pnpm (recommended) or npm
- OpenAI API key
- Postgres connection string

## Getting Started

1. Clone the repository and navigate to the project directory:

```bash
git clone https://github.com/mastra-ai/mastra
cd examples/basics/rag/rerank
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
