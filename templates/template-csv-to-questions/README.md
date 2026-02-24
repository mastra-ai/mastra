# Chat with PDF

An AI-powered PDF assistant that lets you chat with any PDF document. Ask questions about the content, get answers with page citations, and optionally generate quizzes to test your comprehension. Uses RAG (Retrieval-Augmented Generation) to find relevant passages and provide accurate, sourced answers. Built with [Mastra](https://mastra.ai).

## Why we built this

Putting an entire PDF in a context window hits token limits, wastes money on irrelevant tokens, and causes context drift—where the model loses focus as it wades through pages of text that don't matter. RAG solves this: the PDF gets chunked into vector embeddings, and when you ask a question, only the most relevant chunks are included in the prompt. This keeps your costs down, avoids context limits, and gives the model focused context for better answers.

This template shows how Mastra's RAG capabilities, vector storage, and agent workflows fit together—and gives you a starting point to build your own document chat experience.

## Demo

https://github.com/user-attachments/assets/a3731ef5-a531-4f56-8695-8d05b7f81024

This demo runs in Mastra Studio, but you can connect this agent to your React, Next.js, or Vue app using the [Mastra Client SDK](https://mastra.ai/docs/server/mastra-client) or agentic UI libraries like [AI SDK UI](https://mastra.ai/guides/build-your-ui/ai-sdk-ui), [CopilotKit](https://mastra.ai/guides/build-your-ui/copilotkit), or [Assistant UI](https://mastra.ai/guides/build-your-ui/assistant-ui).

## Features

- **No token limits**: chat with 500-page textbooks as easily as a 5-page memo
- **Page citations**: every answer references its source pages so you can verify
- **Quiz generation**: active recall quizzes generated from your actual content

## Quick start

1. **Clone the template**
   - Run `npx create-mastra@latest --template chat-with-pdf` to scaffold the project locally.
2. **Add your API key**
   - Copy `.env.example` to `.env` and fill in your OpenAI API key.
3. **Start the dev server**
   - Run `npm run dev` and open [localhost:4111](http://localhost:4111) to try it out.

Open Studio and start chatting with the PDF agent. Provide a PDF URL to index it, then ask questions about the content or request a quiz on specific pages or topics. The agent searches the indexed content, answers questions with page citations, and can generate comprehension quizzes from actual passages.

> Need a PDF to try? Grab our free book, [Principles of Building AI Agents](https://mastra.ai/books/principles-of-building-ai-agents).

## Making it yours

Swap in a different embedding model, adjust the chunking strategy, or wire the agent into your app using the [Mastra Client SDK](https://mastra.ai/docs/server/mastra-client). You can also swap out LibSQL for another vector database — Mastra supports [many options](https://mastra.ai/docs/storage/vector-databases) including Pinecone, Qdrant, Chroma, pgvector, and more. The agent, tools, and workflow are all in `src/` — edit them directly to fit your use case.

## About Mastra templates

[Mastra templates](https://mastra.ai/templates) are ready-to-use projects that show off what you can build — clone one, poke around, and make it yours. They live in the [Mastra monorepo](https://github.com/mastra-ai/mastra) and are automatically synced to standalone repositories for easier cloning.

Want to contribute? See [CONTRIBUTING.md](./CONTRIBUTING.md).















# CSV to Questions Generator

A Mastra template that demonstrates **how to protect against token limits** by generating AI summaries from large CSV datasets before passing as output from tool calls.

> **🎯 Key Learning**: This template shows how to use large context window models (OpenAI GPT-4.1 Mini) as a "summarization layer" to compress large CSV datasets into focused summaries, enabling efficient downstream processing without hitting token limits.

## Overview

This template showcases a crucial architectural pattern for working with large datasets and LLMs:

**🚨 The Problem**: Large CSV files can contain 100,000+ rows and columns, which would overwhelm context windows and cost thousands of tokens for processing.

**✅ The Solution**: Use a large context window model (OpenAI GPT-4.1 Mini) to generate focused summaries, then use those summaries for downstream processing.

### Workflow

1. **Input**: CSV URL
2. **Download & Summarize**: Fetch CSV, parse data, and generate AI summary using OpenAI GPT-4.1 Mini
3. **Generate Questions**: Create focused questions from the summary (not the raw data)

### Key Benefits

- **📉 Token Reduction**: 80-95% reduction in token usage
- **🎯 Better Quality**: More focused questions from key data insights
- **💰 Cost Savings**: Dramatically reduced processing costs
- **⚡ Faster Processing**: Summaries are much faster to process than raw CSV data

## Prerequisites

- Node.js 22.13.0 or later
- API key for your chosen provider (for both summarization and question generation)

## Setup

1. **Clone and install dependencies:**

   ```bash
   git clone <repository-url>
   cd template-csv-to-questions
   pnpm install
   ```

2. **Set up environment variables:**

   ```bash
   cp .env.example .env
   # Edit .env and add your API keys
   ```

   ```env
   OPENAI_API_KEY="your-openai-api-key-here"
   ```

3. **Run the example:**

   ```bash
   npx tsx example.ts
   ```

## Model Configuration

This template supports any AI model provider through Mastra's model router. You can use models from:

- **OpenAI**: `openai/gpt-4o-mini`, `openai/gpt-4o`
- **Anthropic**: `anthropic/claude-sonnet-4-5-20250929`, `anthropic/claude-haiku-4-5-20250929`
- **Google**: `google/gemini-2.5-pro`, `google/gemini-2.0-flash-exp`
- **Groq**: `groq/llama-3.3-70b-versatile`, `groq/llama-3.1-8b-instant`
- **Cerebras**: `cerebras/llama-3.3-70b`
- **Mistral**: `mistral/mistral-medium-2508`

Set the `MODEL` environment variable in your `.env` file to your preferred model.

## 🏗️ Architectural Pattern: Token Limit Protection

This template demonstrates a crucial pattern for working with large datasets in LLM applications:

### The Challenge

When processing large CSV files (sales data, logs, surveys), you often encounter:

- **Token limits**: Datasets can exceed context windows
- **High costs**: Processing 100,000+ rows repeatedly is expensive
- **Poor quality**: LLMs perform worse on extremely long inputs
- **Slow processing**: Large datasets take longer to process

### The Solution: Summarization Layer

Instead of passing raw CSV data through your pipeline:

1. **Use a large context window model** (OpenAI GPT-4.1 Mini) to digest the full dataset
2. **Generate focused summaries** that capture key insights and patterns
3. **Pass summaries to downstream processing** instead of raw data

### Implementation Details

```typescript
// ❌ BAD: Pass full CSV through pipeline
const questions = await generateQuestions(fullCSVData); // 100,000+ tokens!

// ✅ GOOD: Summarize first, then process
const summary = await summarizeWithGPT41Mini(fullCSVData); // 500-1000 tokens
const questions = await generateQuestions(summary); // Much better!
```

### When to Use This Pattern

- **Large datasets**: CSV files with many rows/columns
- **Batch processing**: Multiple CSV files
- **Cost optimization**: Reduce token usage
- **Quality improvement**: More focused processing
- **Chain operations**: Multiple LLM calls on same data

## Usage

### Using the Workflow

```typescript
import { mastra } from './src/mastra/index';

const run = await mastra.getWorkflow('csvToQuestionsWorkflow').createRun();

// Using a CSV URL
const result = await run.start({
  inputData: {
    csvUrl: 'https://example.com/dataset.csv',
  },
});

console.log(result.result.questions);
```

### Using the CSV Questions Agent

```typescript
import { mastra } from './src/mastra/index';

const agent = mastra.getAgent('csvQuestionAgent');

// The agent can handle the full process with natural language
const response = await agent.stream([
  {
    role: 'user',
    content: 'Please download this CSV and generate questions from it: https://example.com/dataset.csv',
  },
]);

for await (const chunk of response.textStream) {
  console.log(chunk);
}
```

### Using Individual Tools

```typescript
import { mastra } from './src/mastra/index';
import { csvFetcherTool } from './src/mastra/tools/download-csv-tool';
import { generateQuestionsFromTextTool } from './src/mastra/tools/generate-questions-from-text-tool';

// Step 1: Download CSV and generate summary
const csvResult = await csvFetcherTool.execute({
  context: { csvUrl: 'https://example.com/dataset.csv' },
  mastra,
  runtimeContext: new RuntimeContext(),
});

console.log(`Downloaded ${csvResult.fileSize} bytes from ${csvResult.rowCount} rows`);
console.log(`Generated ${csvResult.summary.length} character summary`);

// Step 2: Generate questions from summary
const questionsResult = await generateQuestionsFromTextTool.execute({
  context: {
    extractedText: csvResult.summary,
    maxQuestions: 10,
  },
  mastra,
  runtimeContext: new RuntimeContext(),
});

console.log(questionsResult.questions);
```

### Expected Output

```javascript
{
  status: 'success',
  result: {
    questions: [
      "What are the main columns in this CSV dataset?",
      "How many total entries are included in the data?",
      "Which category shows the highest values?",
      "What patterns can you identify in the data?",
      "What insights can be drawn from this dataset for business decisions?",
      // ... more questions
    ],
    success: true
  }
}
```

## Architecture

### Components

- **`csvToQuestionsWorkflow`**: Main workflow orchestrating the process
- **`textQuestionAgent`**: Mastra agent specialized in generating educational questions from text
- **`csvQuestionAgent`**: Complete agent that can handle the full CSV to questions pipeline
- **`csvSummarizationAgent`**: Agent specialized in creating focused summaries from CSV data

### Tools

- **`csvFetcherTool`**: Downloads CSV files from URLs, parses data, and generates AI summaries
- **`generateQuestionsFromTextTool`**: Generates comprehensive questions from summarized content

### Workflow Steps

1. **`download-and-summarize-csv`**: Downloads CSV from provided URL and generates AI summary
2. **`generate-questions-from-summary`**: Creates comprehensive questions from the AI summary

## Features

- ✅ **Token Limit Protection**: Demonstrates how to handle large datasets without hitting context limits
- ✅ **80-95% Token Reduction**: AI summarization drastically reduces processing costs
- ✅ **Large Context Window**: Uses OpenAI GPT-4.1 Mini to handle large datasets efficiently
- ✅ **Zero System Dependencies**: Pure JavaScript solution
- ✅ **Single API Setup**: OpenAI for both summarization and question generation
- ✅ **Fast Data Processing**: Direct CSV parsing with intelligent sampling
- ✅ **Data Analysis Focus**: Generates questions focused on patterns, insights, and practical applications
- ✅ **Multiple Interfaces**: Workflow, Agent, and individual tools available

## How It Works

### Data Processing Strategy

This template uses a **pure JavaScript approach** that works for most CSV files:

1. **CSV Parsing**: Direct parsing using custom CSV parser
   - ⚡ Fast and reliable
   - 🔧 Handles quoted fields and various delimiters
   - ✅ Works out of the box

2. **Data Analysis**: Automatic data type detection and structure analysis
   - 📊 Row/column counting
   - 🔍 Data type inference
   - 📈 Sample data extraction

3. **AI Summarization**: Intelligent compression of large datasets
   - 🧠 Pattern recognition
   - 📝 Key insights extraction
   - 💡 Actionable intelligence

### Why This Approach?

- **Scalability**: Handles large datasets without token limits
- **Cost Efficiency**: Dramatically reduces processing costs
- **Quality**: More focused questions from key insights
- **Speed**: Summaries process much faster than raw data
- **Flexibility**: Works with various CSV formats and structures

## Configuration

### Environment Variables

```bash
OPENAI_API_KEY=your_openai_api_key_here
```

### Customization

You can customize the question generation by modifying the agents:

```typescript
export const textQuestionAgent = new Agent({
  id: 'generate-questions-agent',
  name: 'Generate questions from text agent',
  instructions: `
    // Customize instructions here for different question types
    // Focus on specific aspects like statistical analysis, patterns, etc.
  `,
  model: openai('gpt-4o'),
});
```

## Development

### Project Structure

```text
src/mastra/
├── agents/
│   ├── csv-question-agent.ts       # CSV processing and question generation agent
│   ├── csv-summarization-agent.ts  # CSV data summarization agent
│   └── text-question-agent.ts      # Text to questions generation agent
├── tools/
│   ├── download-csv-tool.ts         # CSV download and summarization tool
│   └── generate-questions-from-text-tool.ts # Question generation tool
├── workflows/
│   └── csv-to-questions-workflow.ts # Main workflow
└── index.ts                         # Mastra configuration
```

### Testing

```bash
# Run with a test CSV
export OPENAI_API_KEY="your-api-key"
npx tsx example.ts
```

## Common Issues

### "OPENAI_API_KEY is not set"

- Make sure you've set the environment variable
- Check that your API key is valid and has sufficient credits

### "Failed to download CSV"

- Verify the CSV URL is accessible and publicly available
- Check network connectivity
- Ensure the URL points to a valid CSV file
- Some servers may require authentication or have restrictions

### "No data could be parsed"

- The CSV might be malformed or use unusual delimiters
- Very large CSV files might take longer to process
- Check that the file actually contains CSV data

### "Context length exceeded" or Token Limit Errors

- **This shouldn't happen** with the new architecture!
- The AI summarization should prevent token limits
- If it occurs, try using a smaller CSV file for testing

## Example CSV URLs

For testing, you can use these public CSV files:

- World GDP Data: `https://raw.githubusercontent.com/plotly/datasets/master/2014_world_gdp_with_codes.csv`
- Cities Data: `https://people.sc.fsu.edu/~jburkardt/data/csv/cities.csv`
- Sample Dataset: `https://raw.githubusercontent.com/holtzy/data_to_viz/master/Example_dataset/1_OneNum.csv`

## What Makes This Template Special

### 🎯 **Token Limit Protection**

- Demonstrates the summarization pattern for large datasets
- Shows how to compress data while preserving key insights
- Prevents token limit errors that plague other approaches

### ⚡ **Performance & Cost Optimization**

- 80-95% reduction in token usage
- Much faster processing than raw data approaches
- Dramatically lower API costs

### 🔧 **Developer-Friendly Architecture**

- Clean separation of concerns
- Multiple usage patterns (workflow, agent, tools)
- Easy to understand and modify
- Comprehensive error handling

### 📚 **Educational Value**

- Generates questions focused on data analysis and insights
- Covers different comprehension levels
- Perfect for creating learning materials from datasets

## 🚀 Broader Applications

This token limit protection pattern can be applied to many other scenarios:

### Data Processing

- **Log analysis**: Summarize large log files before pattern analysis
- **Survey data**: Compress responses before sentiment analysis
- **Financial data**: Extract key metrics before trend analysis

### Content Analysis

- **Social media**: Summarize large datasets before insight extraction
- **Customer feedback**: Compress reviews before theme identification
- **Research data**: Extract key findings before comparison

### Business Intelligence

- **Sales data**: Summarize transactions before performance analysis
- **User behavior**: Compress activity logs before pattern detection
- **Market research**: Extract insights before strategic planning

### Implementation Tips

- Use **OpenAI GPT-4.1 Mini** for initial summarization (large context window)
- Pass **summaries** to downstream tools, not raw data
- **Chain summaries** for multi-step processing
- **Preserve metadata** (row count, column info) for context

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
