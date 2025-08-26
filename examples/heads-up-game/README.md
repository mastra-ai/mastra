# Heads Up Game

A multi-turn human-in-the-loop workflow.

## Prerequisites

- Node.js v20.0+
- npm
- Openai API key

## Getting Started

1. Clone the repository and navigate to the project directory:

   ```bash
   git clone https://github.com/mastra-ai/mastra
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
   npm install
   ```

4. Run the example:

   ```bash
   npm run dev
   ```
