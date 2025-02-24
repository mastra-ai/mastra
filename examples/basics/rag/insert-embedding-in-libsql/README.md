# Insert embedding in LibSQL

This example demonstrates how to store embeddings in LibSQL using Mastra. It shows how to:

1. Create a document and chunk it
2. Generate embeddings using OpenAI
3. Store the embeddings in LibSQL for similarity search

## Prerequisites

- Node.js v20.0+
- pnpm (recommended) or npm
- OpenAI API key
- LibSQL database

## Getting Started

1. Clone the repository and navigate to the project directory:

   ```bash
   git clone https://github.com/mastra-ai/mastra
   cd examples/basics/rag/insert-embedding-in-libsql
   ```

2. Copy the environment variables file and add your OpenAI API key:

   ```bash
   cp .env.example .env
   ```

   Then edit `.env` and add your OpenAI API key and LibSQL database URL:

   ```env
   OPENAI_API_KEY=sk-your-api-key-here
   DATABASE_URL=libsql://your-database-url
   DATABASE_AUTH_TOKEN=your-database-auth-token (optional)
   ```

3. Install dependencies:

   ```
   pnpm install
   ```

4. Run the example:

   ```bash
   pnpm start
   ```

## How it works

The example:

1. Creates a document from text and chunks it
2. Generates embeddings for each chunk using OpenAI's text-embedding-3-small model
3. Creates a collection in LibSQL with the appropriate dimensions (1536 for text-embedding-3-small)
4. Inserts the embeddings along with their metadata into LibSQL

The stored embeddings can then be used for similarity search and retrieval in your RAG applications.
