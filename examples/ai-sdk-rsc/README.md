# Mastra + AI SDK RSC

This example demonstrates how to integrate [Mastra](https://mastra.ai) with [AI SDK RSC](https://ai-sdk.dev/docs/ai-sdk-rsc/overview) in a Next.js application. It showcases a weather agent with real-time chat capabilities, persistent memory, and tool integration.

## Features

- **Real-time Chat Interface**: Uses AI SDK RSC Stream Values interface
- **Weather Agent**: Intelligent agent powered by OpenAI's GPT-4o that provides weather information
- **Tool Integration**: Custom weather tool that fetches real-time data from Open-Meteo API
- **Persistent Memory**: Conversation history stored using LibSQL with Mastra Memory
- **Modern UI**: Clean chat interface built with Tailwind CSS
- **Full-stack Setup**: Complete Next.js application with API routes

## What You'll Learn

- How to set up Mastra agents with AI SDK RSC compatibility
- Implementing persistent conversation memory
- Building streaming chat interfaces with RSC capabilities on Next.js
- Integrating Mastra with modern React patterns

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm/yarn

### Installation

1. Install dependencies:

```bash
pnpm install
```

2. Start the development server:

```bash
pnpm dev
```

3. Open [http://localhost:3000](http://localhost:3000) to see the chat interface

### Environment Setup

The example uses OpenAI's GPT-4o model. Make sure to set your OpenAI API key:

```bash
# Create a .env.local file
echo "OPENAI_API_KEY=your_openai_api_key_here" > .env.local
```

## How It Works

### Mastra Configuration

The application is configured with a weather agent that:

- Uses OpenAI's GPT-4o model for natural language processing
- Has access to a weather tool for fetching real-time weather data
- Maintains conversation memory using LibSQL storage
- Provides helpful, conversational weather assistance

### AI SDK RSC Integration

The example shows how to:

- Use Mastra agents with AI SDK RSC streaming responses
- Call a server action wrapping Mastra that returns a stream
- Stream responses back to the UI
- Load initial conversation history from Mastra Memory in a RSC

### Key Components

- **`/app/page.tsx`**: RSC used to load conversation history
- **`/app/actions.tsx`**: Server actions for passing user input and streaming agent response
- **`/app/chat.tsx`**: Client component for capturing user input and reading streamed response from action
- **`/src/mastra/`**: Mastra configuration, agents, and tools

## Try It Out

Ask the weather agent questions like:

- "What's the weather in San Francisco?"
- "How's the weather in Tokyo today?"
- "Tell me about the conditions in London"

The agent will use its weather tool to fetch real-time data and provide detailed weather information including temperature, humidity, wind conditions, and more.

## Learn More

- [Mastra Documentation](https://docs.mastra.ai) - Learn about Mastra's features and capabilities
- [AI SDK RSC Documentation](https://ai-sdk.dev/docs/ai-sdk-rsc/overview) - Explore AI SDK RSC
- [AI SDK RSC Stream Text Cookbook](https://ai-sdk.dev/cookbook/rsc/stream-text) - Vercel's example of streaming text
