# Retrieve results

A simple example showing how to retrieve results from pinecone using Mastra and OpenAI.

## Prerequisites

- Node.js v20.0+
- pnpm (recommended) or npm
- OpenAI API key
- Pinecone API key

## Getting Started

1. Clone the repository and navigate to the project directory:

   ```bash
   git clone https://github.com/mastra-ai/mastra
   cd examples/basics/rag/retrieve-results
   ```

2. Copy the environment variables file and add your OpenAI API key:

   ```bash
   cp .env.example .env
   ```

   Then edit `.env` and add your OpenAI API key:

   ```env
   OPENAI_API_KEY=sk-your-api-key-here
   PINECONE_API_KEY=your-pinecone-api-key-here
   ```

3. Install dependencies:

   ```
   pnpm install
   ```

4. Run the example:

   ```bash
   pnpm start
   ```