# Interactive Storyteller

An AI-powered storytelling app that creates interactive stories with voice narration using Next.js, Mastra, and OpenAI.

## Getting Started

### Prerequisites

1. Install dependencies:

```bash
pnpm install
```

2. Set up your environment:
   Create a `.env.development` file in the root directory with your OpenAI API key:

```env
OPENAI_API_KEY=your_api_key_here
```

### Running the App

1. Start the Mastra development server:

```bash
pnpm mastra:dev
```

2. In a new terminal, start the Next.js development server:

```bash
pnpm dev
```

3. Open [http://localhost:3000](http://localhost:3000) with your browser to start creating interactive stories!

## Features

- Interactive storytelling with choices that affect the narrative
- AI-powered story generation
- Voice narration using OpenAI's text-to-speech
- Clean, modern UI built with Next.js and Tailwind CSS

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
