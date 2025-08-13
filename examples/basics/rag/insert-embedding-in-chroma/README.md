# Insert embedding in Chroma

This example demonstrates how to store embeddings in [Chroma](https://docs.trychroma.com/docs/overview/getting-started) using Mastra. It shows how to:

1. Create a document and chunk it
2. Generate embeddings using OpenAI
3. Store the embeddings in Chroma for similarity search
4. Use Chroma-specific features like document storage and filtering

## Prerequisites

- Node.js v20.0+
- pnpm (recommended) or npm
- OpenAI API key
- Optional: Chroma Cloud API key

## Getting Started

1. Clone the repository and navigate to the project directory:

   ```bash
   git clone https://github.com/mastra-ai/mastra
   cd examples/basics/rag/insert-embedding-in-chroma
   ```

2. Install dependencies:

   ```
   pnpm install
   ```

3. Copy the environment variables file and add your OpenAI API key:

   ```bash
   cp .env.example .env
   ```

   Then edit `.env` and add your OpenAI API key:

   ```env
   OPENAI_API_KEY=sk-your-api-key-here
   ```

   If you want to use [Chroma Cloud](https://trychroma.com/signup), add your Chroma Cloud API Key, tenant, and database. When you install your dependencies, you get the [Chroma CLI](https://docs.trychroma.com/docs/cli/db), which can output these variables for you with `chroma db connect [DB-NAME] --env-file`

   ```env
   CHROMA_API_KEY=your-chroma-cloud-api-key
   CHROMA_TENANT=your-tenant-id
   CHROMA_DATABASE=your-database-name
   ```

4. Set up your Chroma server.
   - If you are using Chroma Cloud, you are ready to go.
   - For running locally, start a Chroma server with the CLI: `chroma run`. See more configurations on the [Chroma docs](https://docs.trychroma.com/docs/cli/run).
   - If you deployed a Chroma server yourself, edit the `ChromaVector` instantiation with your specific connection requirements.

5. Run the example:

   ```bash
   pnpm start
   ```

## How it works

The example:

1. Creates a document from text and chunks it
2. Generates embeddings for each chunk using OpenAI's text-embedding-3-small model
3. Creates a collection in Chroma with the appropriate dimensions (1536 for text-embedding-3-small)
4. Inserts the embeddings along with their metadata into Chroma

### Chroma-specific Features

This example also demonstrates features specific to ChromaDB:

**Document Storage**: Along with embeddings and metadata, you can store the original text documents in Chroma. This is useful for retrieving the full text during queries without needing a separate document store.

The stored embeddings and documents can then be used for similarity search and retrieval in your RAG applications.
