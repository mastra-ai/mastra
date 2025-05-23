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

### Quick Start

```bash
# Create new project
npm create mastra@latest -- --template nextjs-direct

# OR with pnpm (recommended for Windows users)
pnpm create mastra@latest --template nextjs-direct

# Install dependencies (in the created project directory)
pnpm install  # Recommended for better compatibility

# Set up environment variables
cp .env.example .env.local

# Start development server
pnpm dev
```

### Environment Setup

Add your OpenAI API key to `.env.local`:

```
OPENAI_API_KEY=your_openai_api_key_here
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

### Installation Issues

- **Package manager freezes**: If `npm create mastra@latest` freezes, try using pnpm instead
- **Native dependency errors**: Issues with @swc/core, esbuild, mastra, or protobufjs may occur during installation
- **Node.js compatibility**: Use an LTS version of Node.js (recommended: Node.js 18.x or 20.x)

### Common Solutions

- Clear npm cache: `npm cache clean --force`
- Use pnpm for better dependency resolution: `pnpm install`
- For detailed error logs: Add `DEBUG=mastra:*` to your .env.local file
- Windows users may need to install build tools: `npm install --global windows-build-tools`

## Documentation

For more information about Mastra and Next.js integration, check out:

- [Mastra Documentation](https://mastra.ai/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Mastra Next.js Integration Guide](https://mastra.ai/docs/frameworks/next-js)
