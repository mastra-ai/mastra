# Heads Up Game

A multi-turn human-in-the-loop workflow.

## Prerequisites

- Node.js v20.0+
- pnpm (recommended) or npm
- Openai API key

## Getting Started

1. Clone the repository and navigate to the project directory:

   ```bash
   git clone https://github.com/mastra-ai/mastra --depth=1
   cd examples/heads-up-game
   ```

2. Copy the environment variables file and add your Openai API key:

   ```bash
   cp .env.example .env
   ```

   Then edit `.env` and add your Openai API key:

   ```env
   OPENAI_API_KEY=sk-your-api-key-here
   ```

3. Install dependencies:

   ```
   pnpm install --ignore-workspace
   ```

4. Run the example:

   ```bash
   pnpm dev
   ```

5. Test in Playground:

   ```bash
   http://localhost:4111
   ```
