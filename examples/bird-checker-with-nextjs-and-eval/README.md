# Bird Checker with eval

A Next.js application that gets a random image from [Unsplash](https://unsplash.com/) that matches a selected query and uses a [Mastra AI Agent](https://mastra.ai/docs/agents/00-overview) to determine if it is a bird or not. It also has braintrust eval to use evaluate the llm prompt

## Features

- 🕊️ Get random image from unspash that matches a selected query
- 🤖 AI agent that returns a structured response
- 🔵 Braintrust eval to evaluate the prompt
- 🎨 Modern UI with syntax highlighting

## Prerequisites

- Node.js 18+
- pnpm (recommended) or npm
- Anthropic API Key
- Unsplash Access Key
- Braintrust API Key

## Getting Started

1. Clone the repository:

```bash
git clone <repository-url>
cd bird-checker-with-nextjs-and-eval
```

2. Install dependencies:

```bash
pnpm install
```

3. Copy the environment variables file:

```bash
cp .env.example .env.local
```

4. Configure your environment variables:

```env
# Required for getting image
NEXT_PUBLIC_UNSPLASH_ACCESS_KEY=your_unsplash_access_key

# Required for AI processing
ANTHROPIC_API_KEY=your_anthropic_key

# Required for evalutating the llm prompt
BRAINTRUST_API_KEY=your_braintrust_key
```

5. Start the development server:

```bash
pnpm dev
```

6. Evaluate the llm prompt:

```bash
pnpm braintrust:eval
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Usage

1. Click on any of the query tags - Wildlife | Feathers | Flying | Birds

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[MIT](LICENSE)
