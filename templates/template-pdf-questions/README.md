# PDF to Questions Generator

A Mastra template that demonstrates **how to protect against token limits** by generating AI summaries from large datasets before passing as output from tool calls.

> **🎯 Key Learning**: This template shows how to use large context window models (OpenAI GPT-4.1 Mini) as a "summarization layer" to compress large documents into focused summaries, enabling efficient downstream processing without hitting token limits.

## Overview

This template showcases a crucial architectural pattern for working with large documents and LLMs:

**🚨 The Problem**: Large PDFs can contain 50,000+ tokens, which would overwhelm context windows and cost thousands of tokens for processing.

**✅ The Solution**: Use a large context window model (OpenAI GPT-4.1 Mini) to generate focused summaries, then use those summaries for downstream processing.

### Workflow

1. **Input**: PDF URL
2. **Download & Summarize**: Fetch PDF, extract text, and generate AI summary using OpenAI GPT-4.1 Mini
3. **Generate Questions**: Create focused questions from the summary (not the full text)

### Key Benefits

- **📉 Token Reduction**: 80-95% reduction in token usage
- **🎯 Better Quality**: More focused questions from key insights
- **💰 Cost Savings**: Dramatically reduced processing costs
- **⚡ Faster Processing**: Summaries are much faster to process than full text

## Prerequisites

- Node.js 22.13.0 or later
- API key for your chosen provider (for both summarization and question generation)

## Setup

1. **Clone and install dependencies:**

   ```bash
   git clone <repository-url>
   cd template-pdf-questions
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

When processing large documents (PDFs, reports, transcripts), you often encounter:

- **Token limits**: Documents can exceed context windows
- **High costs**: Processing 50,000+ tokens repeatedly is expensive
- **Poor quality**: LLMs perform worse on extremely long inputs
- **Slow processing**: Large inputs take longer to process

### The Solution: Summarization Layer

Instead of passing raw data through your pipeline:

1. **Use a large context window model** (OpenAI GPT-4.1 Mini) to digest the full content
2. **Generate focused summaries** that capture key information
3. **Pass summaries to downstream processing** instead of raw data

### Implementation Details

```typescript
// ❌ BAD: Pass full text through pipeline
const questions = await generateQuestions(fullPdfText); // 50,000 tokens!

// ✅ GOOD: Summarize first, then process
const summary = await summarizeWithGPT41Mini(fullPdfText); // 2,000 tokens
const questions = await generateQuestions(summary); // Much better!
```

### When to Use This Pattern

- **Large documents**: PDFs, reports, transcripts
- **Batch processing**: Multiple documents
- **Cost optimization**: Reduce token usage
- **Quality improvement**: More focused processing
- **Chain operations**: Multiple LLM calls on same data

## Usage

### Using the Workflow

```typescript
import { mastra } from './src/mastra/index';

const run = await mastra.getWorkflow('pdfToQuestionsWorkflow').createRun();

// Using a PDF URL
const result = await run.start({
  inputData: {
    pdfUrl: 'https://example.com/document.pdf',
  },
});

console.log(result.result.questions);
```

### Using the PDF Questions Agent

```typescript
import { mastra } from './src/mastra/index';

const agent = mastra.getAgent('pdfQuestionsAgent');

// The agent can handle the full process with natural language
const response = await agent.stream([
  {
    role: 'user',
    content: 'Please download this PDF and generate questions from it: https://example.com/document.pdf',
  },
]);

for await (const chunk of response.textStream) {
  console.log(chunk);
}
```

### Using Individual Tools

```typescript
import { mastra } from './src/mastra/index';
import { pdfFetcherTool } from './src/mastra/tools/download-pdf-tool';
import { generateQuestionsFromTextTool } from './src/mastra/tools/generate-questions-from-text-tool';

// Step 1: Download PDF and generate summary
const pdfResult = await pdfFetcherTool.execute({
  context: { pdfUrl: 'https://example.com/document.pdf' },
  mastra,
  runtimeContext: new RuntimeContext(),
});

console.log(`Downloaded ${pdfResult.fileSize} bytes from ${pdfResult.pagesCount} pages`);
console.log(`Generated ${pdfResult.summary.length} character summary`);

// Step 2: Generate questions from summary
const questionsResult = await generateQuestionsFromTextTool.execute({
  context: {
    extractedText: pdfResult.summary,
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
      "What is the main objective of the research presented in this paper?",
      "Which methodology was used to collect the data?",
      "What are the key findings of the study?",
      // ... more questions
    ],
    success: true
  }
}
```

## Architecture

### Components

- **`pdfToQuestionsWorkflow`**: Main workflow orchestrating the process
- **`textQuestionAgent`**: Mastra agent specialized in generating educational questions
- **`pdfQuestionAgent`**: Complete agent that can handle the full PDF to questions pipeline

### Tools

- **`pdfFetcherTool`**: Downloads PDF files from URLs, extracts text, and generates AI summaries
- **`generateQuestionsFromTextTool`**: Generates comprehensive questions from summarized content

### Workflow Steps

1. **`download-and-summarize-pdf`**: Downloads PDF from provided URL and generates AI summary
2. **`generate-questions-from-summary`**: Creates comprehensive questions from the AI summary

## Features

- ✅ **Token Limit Protection**: Demonstrates how to handle large datasets without hitting context limits
- ✅ **80-95% Token Reduction**: AI summarization drastically reduces processing costs
- ✅ **Large Context Window**: Uses large context window models to handle documents efficiently
- ✅ **Zero System Dependencies**: Pure JavaScript solution
- ✅ **Multi-Provider Support**: Choose from OpenAI, Anthropic, Google, Groq, Cerebras, or Mistral
- ✅ **Fast Text Extraction**: Direct PDF parsing (no OCR needed for text-based PDFs)
- ✅ **Educational Focus**: Generates focused learning questions from key insights
- ✅ **Multiple Interfaces**: Workflow, Agent, and individual tools available

## How It Works

### Text Extraction Strategy

This template uses a **pure JavaScript approach** that works for most PDFs:

1. **Text-based PDFs** (90% of cases): Direct text extraction using `pdf2json`
   - ⚡ Fast and reliable
   - 🔧 No system dependencies
   - ✅ Works out of the box

2. **Scanned PDFs**: Would require OCR, but most PDFs today contain embedded text

### Why This Approach?

- **Simplicity**: No GraphicsMagick, ImageMagick, or other system tools needed
- **Speed**: Direct text extraction is much faster than OCR
- **Reliability**: Works consistently across different environments
- **Educational**: Easy for developers to understand and modify
- **Single Path**: One clear workflow with no complex branching

## Configuration

### Environment Variables

```bash
OPENAI_API_KEY=your_openai_api_key_here
```

### Customization

You can customize the question generation by modifying the `textQuestionAgent`:

```typescript
export const textQuestionAgent = new Agent({
  id: 'generate-questions-agent',
  name: 'Generate questions from text agent',
  instructions: `
    You are an expert educational content creator...
    // Customize instructions here
  `,
  model: openai('gpt-4o'),
});
```

## Development

### Project Structure

```text
src/mastra/
├── agents/
│   ├── pdf-question-agent.ts       # PDF processing and question generation agent
│   └── text-question-agent.ts      # Text to questions generation agent
├── tools/
│   ├── download-pdf-tool.ts         # PDF download tool
│   ├── extract-text-from-pdf-tool.ts # PDF text extraction tool
│   └── generate-questions-from-text-tool.ts # Question generation tool
├── workflows/
│   └── generate-questions-from-pdf-workflow.ts # Main workflow
├── lib/
│   └── util.ts                      # Utility functions including PDF text extraction
└── index.ts                         # Mastra configuration
```

### Testing

```bash
# Run with a test PDF
export OPENAI_API_KEY="your-api-key"
npx tsx example.ts
```

## Common Issues

### "OPENAI_API_KEY is not set"

- Make sure you've set the environment variable
- Check that your API key is valid and has sufficient credits

### "Failed to download PDF"

- Verify the PDF URL is accessible and publicly available
- Check network connectivity
- Ensure the URL points to a valid PDF file
- Some servers may require authentication or have restrictions

### "No text could be extracted"

- The PDF might be password-protected
- Very large PDFs might take longer to process
- Scanned PDFs without embedded text won't work (rare with modern PDFs)

### "Context length exceeded" or Token Limit Errors

- **Solution**: Use a smaller PDF file (under ~5-10 pages)
- **Automatic Truncation**: The tool automatically uses only the first 4000 characters for very large documents
- **Helpful Errors**: Clear messages guide you to use smaller PDFs when needed

## What Makes This Template Special

### 🎯 **True Simplicity**

- Single dependency for PDF processing (`pdf2json`)
- No system tools or complex setup required
- Works immediately after `pnpm install`
- Multiple usage patterns (workflow, agent, tools)

### ⚡ **Performance**

- Direct text extraction (no image conversion)
- Much faster than OCR-based approaches
- Handles reasonably-sized documents efficiently

### 🔧 **Developer-Friendly**

- Pure JavaScript/TypeScript
- Easy to understand and modify
- Clear separation of concerns
- Simple error handling with helpful messages

### 📚 **Educational Value**

- Generates multiple question types
- Covers different comprehension levels
- Perfect for creating study materials

## 🚀 Broader Applications

This token limit protection pattern can be applied to many other scenarios:

### Document Processing

- **Legal documents**: Summarize contracts before analysis
- **Research papers**: Extract key findings before comparison
- **Technical manuals**: Create focused summaries for specific topics

### Content Analysis

- **Social media**: Summarize large thread conversations
- **Customer feedback**: Compress reviews before sentiment analysis
- **Meeting transcripts**: Extract action items and decisions

### Data Processing

- **Log analysis**: Summarize error patterns before classification
- **Survey responses**: Compress feedback before theme extraction
- **Code reviews**: Summarize changes before generating reports

### Implementation Tips

- Use **OpenAI GPT-4.1 Mini** for initial summarization (large context window)
- Pass **summaries** to downstream tools, not raw data
- **Chain summaries** for multi-step processing
- **Preserve metadata** (file size, page count) for context

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
