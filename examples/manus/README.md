# AI Research Assistant with Mastra vNext Workflows

This project implements an advanced AI research assistant using Mastra's vNext workflows and agent capabilities. It creates an interactive, human-in-the-loop research system that allows users to explore topics, evaluate results, and generate comprehensive reports.

## How to Use

```bash
# Install dependencies
npm install

# Run the research assistant
npm run dev
```

Follow the interactive prompts:

1. Enter your research topic
2. Specify depth (1-3) and breadth (1-5) parameters
3. Review the research findings
4. Approve or reject the research results
5. If approved, a comprehensive report will be generated (report.md)

## Required Environment Variables

Create a `.env` file with:

```
EXA_API_KEY="your-exa-api-key"
OPENAI_API_KEY="your-openai-api-key"
```

## Required Dependencies

- `@mastra/core`: Core Mastra functionality with vNext workflows
- `@ai-sdk/openai`: OpenAI models integration
- `exa-js`: Exa API client for web search
- `zod`: Schema definition and validation for workflows

## Source Code

- [aie-feb-25-starter-mastra](https://github.com/mastra-ai/aie-feb-25-starter-mastra)
