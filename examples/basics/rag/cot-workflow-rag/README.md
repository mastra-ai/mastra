# Retrieve results

A simple example showing how to use Chain of Thought Prompting w/Workflows with RAG using Mastra, OpenAI, and PGVector.

## Prerequisites

- Node.js v20.0+
- pnpm (recommended) or npm
- OpenAI API key
- Postgres connection string

## Getting Started

1. Clone the repository and navigate to the project directory:

   ```bash
   git clone https://github.com/mastra-ai/mastra
   cd examples/basics/rag/cot-workflow-rag
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

   ```
   pnpm install
   ```

4. Run the example:

   ```bash
   pnpm start
   ```
