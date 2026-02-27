# Flash Cards from PDF

A Mastra template that generates educational flash cards from PDF documents. Attach a PDF in Mastra Studio, and the agent creates flash cards with optional AI-generated images.

## Quick Start

### Prerequisites

- Node.js >= 22.13.0
- An [OpenAI API key](https://platform.openai.com/api-keys)

### Setup

```bash
npx create-mastra@latest --template flash-cards-from-pdf
cd template-flash-cards-from-pdf
```

Copy `.env.example` to `.env` and add your OpenAI API key:

```bash
cp .env.example .env
```

```
OPENAI_API_KEY=sk-...
```

Start the development server:

```bash
npm run dev
```

### Usage

1. Open Mastra Studio (starts automatically with `npm run dev`)
2. Select the **Flash Card Agent**
3. Attach a PDF file using the attachment button in the chat
4. Ask the agent to generate flash cards (e.g., "Create flash cards from this PDF")
5. Optionally ask for images: "Generate flash cards with images for the key concepts"
