# Mastra Next.js Template (Direct Integration)

This template provides a quick start for integrating Mastra directly into your Next.js application.

## Features

- Next.js 13+ with App Router
- Mastra AI agent integration with direct access
- Sample weather query implementation
- TypeScript support
- Tailwind CSS for styling

## Getting Started

### Installation

1. Create a new Next.js project with this template:

```bash
# Using npx
npx create-next-app my-mastra-app --example https://github.com/OmkarBansod02/mastra/tree/main/templates/frameworks/nextjs/direct-integration

# Or clone this template manually
git clone https://github.com/OmkarBansod02/mastra.git
cp -r mastra/templates/frameworks/nextjs/direct-integration my-mastra-app
cd my-mastra-app
npm install
```

2. Set up your environment variables:

```bash
cp .env.example .env.local
```

3. Update the `.env.local` file with your API keys.

4. Start the development server:

```bash
npm run dev
```

### Project Structure

```
├── app/                  # Next.js App Router
│   ├── actions.ts        # Server actions for Mastra
│   ├── api/              # API routes
│   │   └── chat/         # Chat API endpoint
│   │       └── route.ts  # Chat route handler
│   ├── components/       # React components
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

## Documentation

For more information about Mastra and Next.js integration, check out:

- [Mastra Documentation](https://mastra.ai/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Mastra Next.js Integration Guide](https://mastra.ai/docs/frameworks/next-js)
