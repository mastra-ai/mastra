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