# Bird Checker with Express JS

An Express.js server that has an API that can get a random image from [Unsplash](https://unsplash.com/) that matches a selected query and another API that uses [Mastra AI Agent](https://mastra.ai/docs/agents/00-overview) to determine if an image is a bird or not. It also has braintrust eval to use evaluate the llm prompt

## Features

- 🕊️ Get random image from unspash that matches a selected query
- 🤖 AI agent that returns a structured response

## Prerequisites

- Node.js 18+
- pnpm (recommended) or npm
- Anthropic API Key
- Unsplash Access Key

## Getting Started

1. Clone the repository:

```bash
git clone <repository-url>
cd bird-checker-with-express
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
UNSPLASH_ACCESS_KEY=your_unsplash_access_key

# Required for AI processing
ANTHROPIC_API_KEY=your_anthropic_key

# The port you want your server to run on (optional)
PORT=your_preferred_port
```

5. Start the development server:

```bash
pnpm start
```

## Usage

Open Postman or your preferred platofrom for testing APIs

### Test getRandomImage tool that uses unspash image

Enter `http://localhost:${PORT}/api/get-unsplash-image?query=bird` in the url to get image from unsplash. This is a get request.
The query can be edited to any of the following - `wildlife | bird | feathers | flying`

### Test Mastra AI agent

Enter `http://localhost:${PORT}/api/image-metadata` in the url to get information about an image. This is a post request.
The payload for this request:

```bash copy
{
  imageUrl: "" //the image url
}
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[MIT](LICENSE)
