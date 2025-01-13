# Bird Checker Agent

A simple example agent to determine if an image contains a bird.

## Prerequisites

- Node.js v20.0+
- pnpm (recommended) or npm
- Anthropic API key

## Getting Started

1. Clone the repository and navigate to the project directory:

   ```bash
   git clone https://github.com/mastra-ai/mastra
   cd examples/basics/agents/bird-checker
   ```

2. Copy the environment variables file and add your Anthropic API key and Unsplash access token:

   ```bash
   cp .env.example .env
   ```

   Then edit `.env` and add your Anthropic API key:

   ```env
   ANTHROPIC_API_KEY=sk-your-api-key-here
   ```

   Finally add your Unsplash access token:

   ```env
   ANTHROPIC_API_KEY=sk-your-api-key-here
   ```

3. Install dependencies:

   ```
   pnpm install
   ```

4. Run the example:

   ```bash
   pnpm start
   ```
