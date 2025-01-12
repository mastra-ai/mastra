# Mastra Needle Example

This example demonstrates how to use Needle's RAG (Retrieval Augmented Generation) capabilities with Mastra agents. It shows how to create a knowledge-based agent that can search through your documents and provide accurate answers based on the retrieved information.

## Prerequisites

This follows up on the main README.md to install Mastra:

- Node.js (v20.0+)
- A Needle API key (get one at [Needle Dashboard](https://needle.ai))
- A Needle collection ID (create one in the Needle Dashboard)
- An OpenAI API key

## Structure

src/
├── mastra/
│ ├── agents/ # Agent definitions
│ │ └── index.ts
│ ├── tools/ # Tool definitions
│ │ └── index.ts
│ ├── workflows/ # Workflow definitions
│ │ └── index.ts
│ └── index.ts # Main exports
└── index.ts # Entry point

## Setup

1. Install dependencies:

```bash
npm install
```

2. Set your environment variables:

You get your Needle API key and collection ID from the Needle Dashboard[https://needle-ai.com]. Create a collection and add documents to it, either upload files or use the API to add documents. You can also set up connectors to add documents from your knowledge base.

```bash
export NEEDLE_API_KEY=<your-needle-api-key>
export NEEDLE_COLLECTION_ID=<your-needle-collection-id>
export OPENAI_API_KEY=<your-openai-api-key>
```

3. Run the application:

```bash
npx tsx src/index.ts
```

## Components

### Agents

- `knowledgeAgent`: An agent that can search through your documents and provide accurate answers based on the retrieved information.

### Tools

- `searchKnowledge`: A tool that can search through your documents and provide relevant information based on the search query.

### Workflows

- `searchAndAnswer`: A workflow that uses the `knowledgeAgent` to search through your documents and provide an answer based on the search query.

## Learn More

- [Mastra Documentation](https://mastra.ai/docs)
- [Needle Documentation](https://docs.needle-ai.com)
- [OpenAI Documentation](https://platform.openai.com/docs)

## Support

If you have any questions or need help:

- Join our [Discord Community](https://discord.gg/XSHaP5pPHT)
- Visit the [Needle Support](https://docs.needle-ai.com)
