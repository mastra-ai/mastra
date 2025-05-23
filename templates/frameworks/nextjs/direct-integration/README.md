# Mastra Next.js Template (Direct Integration)

This template demonstrates how to create a weather agent using the Mastra framework directly integrated with a Next.js application. The agent can provide weather information based on user queries using Next.js server components and server actions.

## Overview

The Mastra Next.js Template showcases how to:

- Create an AI-powered agent using Mastra framework within a Next.js application
- Implement weather tools that connect to external APIs
- Build a React interface for user weather queries
- Use Next.js server actions to communicate with Mastra agents
- Set up a proper project structure for maintainability

## Features

- Next.js 14+ with App Router
- Mastra AI agent with direct integration
- Weather API integration
- TypeScript support
- Tailwind CSS for styling
- Proper error handling and loading states

## Getting Started

### Installation

1. Create a new project with this template:

```bash
# Using npm
npm create mastra@latest -- --template nextjs-direct

# Or clone this template manually
git clone https://github.com/mastra-ai/mastra.git
cp -r mastra/templates/frameworks/nextjs/direct-integration my-mastra-app
cd my-mastra-app
```

2. Install dependencies:

```bash
# Using npm (may have issues with native dependencies)
npm install

# Using pnpm (recommended)
pnpm install
```

3. Set up environment variables:

```bash
cp .env.example .env.local
```

4. Add your OpenAI API key to `.env.local`:

```
OPENAI_API_KEY=your_openai_api_key_here
```

5. Start the development server:

```bash
npm run dev
# or
pnpm dev
```

### Project Structure

```
├── app/                  # Next.js App Router
│   ├── actions.ts        # Server actions for Mastra
│   ├── components/       # React components
│   │   └── WeatherForm   # Weather query interface
│   ├── layout.tsx        # Root layout
│   └── page.tsx          # Home page
├── mastra/               # Mastra configuration
│   ├── agents/           # AI agent definitions
│   ├── tools/            # Custom tools
│   └── index.ts          # Mastra instance
├── public/               # Static assets
├── .env.example          # Environment variables template
├── next.config.js        # Next.js configuration
├── package.json          # Dependencies
└── tsconfig.json         # TypeScript configuration
```

## Known Issues & Troubleshooting

- If you encounter dependency installation issues, try using pnpm instead of npm
- Make sure to use an LTS version of Node.js
- For native dependency build issues, you may need to install build tools for your platform

## Documentation

For more information about Mastra and Next.js integration, check out:

- [Mastra Documentation](https://mastra.ai/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Mastra Next.js Integration Guide](https://mastra.ai/docs/frameworks/next-js)
