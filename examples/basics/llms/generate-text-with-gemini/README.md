# Generate Text with Gemini

A simple example showing how to generate text using Mastra and Google's Gemini model.

## Prerequisites

- Node.js v20.0+
- pnpm (recommended) or npm
- Google API key (Gemini)

## Getting Started

1. Clone the repository and navigate to the project directory:

   ```bash
   git clone https://github.com/mastra-ai/mastra
   cd examples/basics/llms/generate-text-with-gemini
   ```

2. Copy the environment variables file and add your Gemini API key:

   ```bash
   cp .env.example .env
   ```

   Then edit `.env` and add your Gemini API key:

   ```env
   GEMINI_API_KEY=your-api-key-here
   ```

3. Install dependencies:

   ```
   pnpm install
   ```

4. Run the example:

   ```bash
   pnpm start
   ```
