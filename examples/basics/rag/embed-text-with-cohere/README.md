# Embed text with cohere

A simple example showing how to embed a chunk using Mastra and Cohere.

## Prerequisites

- Node.js v20.0+
- pnpm (recommended) or npm
- Cohere API key

## Getting Started

1. Clone the repository and navigate to the project directory:

   ```bash
   git clone https://github.com/mastra-ai/mastra
   cd examples/basics/rag/embed-text-chunk
   ```

2. Copy the environment variables file and add your Cohere API key:

   ```bash
   cp .env.example .env
   ```

   Then edit `.env` and add your Cohere API key:

   ```env
   COHERE_API_KEY=sk-your-api-key-here
   ```

3. Install dependencies:

   ```
   pnpm install
   ```

4. Run the example:

   ```bash
   pnpm start
   ```
