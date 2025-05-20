# Insert embedding in Milvus

A simple example showing how to insert your embedding in Milvus using Mastra and OpenAI.

## Prerequisites

- Node.js v20.0+
- pnpm (recommended) or npm
- OpenAI API key
- Milvus server (local or cloud)

## Getting Started

1. Clone the repository and navigate to the project directory:

   ```bash
   git clone https://github.com/mastra-ai/mastra
   cd examples/basics/rag/insert-embedding-in-milvus
   ```

2. Copy the environment variables file and add your OpenAI API key:

   ```bash
   cp .env.example .env
   ```

   Then edit `.env` and add your OpenAI API key and Milvus credentials:

   ```env
   OPENAI_API_KEY=sk-your-api-key-here
   MILVUS_URI=localhost:19530
   MILVUS_USERNAME=your-username
   MILVUS_PASSWORD=your-password
   MILVUS_SSL=false
   ```

3. Install dependencies:

   ```
   pnpm install
   ```

4. Run the example:

   ```bash
   pnpm start
   ```
