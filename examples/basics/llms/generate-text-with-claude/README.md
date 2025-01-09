# Generate text with claude

A simple example showing how to generate text using Mastra and claude.

## Prerequisites

- Node.js v20.0+
- pnpm (recommended) or npm
- Anthropic API key

## Getting Started

1. Clone the repository and navigate to the project directory:

   ```bash
   git clone https://github.com/mastra-ai/mastra
   cd examples/basics/llms/generate-text-claude
   ```

2. Copy the environment variables file and add your Anthropic API key:

   ```bash
   cp .env.example .env
   ```

   Then edit `.env` and add your Anthropic API key:

   ```env
   ANTHROPIC_API_KEY=your-api-key-here
   ```

3. Install dependencies:

   ```
   pnpm install
   ```

4. Run the example:

   ```bash
   pnpm start
   ```
