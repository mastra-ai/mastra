# Weather AI Chatbot

A modern AI-powered weather chatbot built with Next.js and Vercel's AI SDK, using Mastra for AI capabilities. This chatbot provides interactive weather information through a conversational interface.

## Features

- Real-time weather information
- Natural language conversation
- Built with Next.js and Vercel AI SDK
- Powered by Mastra AI
- Persistent chat history using Drizzle ORM

## Prerequisites

- Node.js (v18 or higher)
- npm
- A Mastra API key

## Getting Started

1. Clone the repository
2. Install dependencies:

   ```bash
   npm install
   ```

3. Set up environment variables:

   - Copy `.env.example` to `.env`
   - Fill in the required environment variables following the example file

4. Run database migrations:

   ```bash
   npm run db:migrate
   ```

5. Start the development server:

   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

## Environment Variables

Make sure to set up the following environment variables in your `.env` file:

```plaintext
# See .env.example for all required variables
POSTGRES_URL=your-postgres-url
OPENAI_API_KEY=your-openai-api-key
AUTH_SECRET="tester"
```

## Development Commands

- `npm install` - Install dependencies
- `npm run db:migrate` - Run Drizzle database migrations
- `npm run dev` - Start development server

## License

MIT
