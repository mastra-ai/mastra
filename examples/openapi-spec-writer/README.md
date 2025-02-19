# OpenAPI Spec Generator

A Next.js application that generates OpenAPI specifications from API documentation URLs and optionally creates pull requests to create a [Mastra integration](https://mastra.ai/docs/local-dev/integrations) from the generated spec.

## Features

- 🔍 Generate OpenAPI specs from documentation URLs
- 🤖 AI-powered API specification generation
- 🔄 Automatic PR creation for Mastra integration
- 📋 Copy-to-clipboard functionality
- 🎨 Modern UI with syntax highlighting

## Prerequisites

- Node.js 18+
- pnpm (recommended) or npm
- GitHub account (for PR creation feature)

## Getting Started

1. Clone the repository:

```bash
git clone <repository-url>
cd openapi-spec-generator
```

2. Install dependencies:

```bash
pnpm install
```

3. Copy the environment variables file:

```bash
cp .env.sample .env.local
```

4. Configure your environment variables:

```env
# Required for API crawling
FIRECRAWL_API_KEY=your_firecrawl_api_key
GITHUB_API_KEY=your_github_token

# Required for AI processing (at least one)
ANTHROPIC_API_KEY=your_anthropic_key
OPENAI_API_KEY=your_openai_key

# Optional: Database URL if using one
DB_URL=your_database_url
```

5. Start the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Usage

1. Enter an API documentation URL in the input field
2. Click "Generate" to create the OpenAPI specification
3. Review the generated specification
4. (Optional) Click "Create PR" to submit the integration to Mastra

## GitHub Actions Integration

When creating a PR through the application, it triggers a GitHub Action in the Mastra repository that:

1. Validates the OpenAPI specification
2. Generates integration code
3. Updates documentation
4. Creates a pull request with the changes

To enable this functionality:

1. Ensure you have a valid GitHub API token with repository access
2. Set the `GITHUB_API_KEY` in your environment variables
3. The PR creation feature is only available in development mode by default

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Deployed url

[https://openapi-spec-writer.vercel.app/](https://openapi-spec-writer.vercel.app/)

## License

[MIT](LICENSE)
