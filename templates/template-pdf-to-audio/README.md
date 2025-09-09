# PDF to Audio Template

A Mastra template that demonstrates how to build an intermediate workflow orchestrating different tools, processing structured PDFs, and showcasing the power of our LLMs to summarize and synthesize content with voice capabilities.

## Why did we build this?

Every developer has encountered the same problem: you have a 50-page technical document, a research paper, or a business report that you need to understand, but you're commuting, walking the dog, or simply prefer consuming information through audio. Traditional text-to-speech solutions produce robotic, monotonous output that's painful to listen to for more than a few minutes.

This template solves that problem by showing you how to build intelligent document processing pipelines that don't just convert text to speech—they understand, summarize, and optimize content for human consumption. You'll learn how to orchestrate multiple AI agents that work together to extract meaning from complex documents and present it in a format that's actually worth listening to.

The real value isn't just in the audio output—it's in understanding how to build production-ready workflows that can handle real-world document processing challenges. Whether you're building accessibility features for your application, creating content for mobile consumption, or developing tools for knowledge workers who need to process information while multitasking, this template gives you the patterns and practices you need to ship something that works.

## Getting Started

Install the template:

```bash
npx create-mastra@latest --template pdf-to-audio
cd pdf-to-audio
```

Set up environment variables by copying the example environment file and adding your OpenAI API key:

```bash
cp .env.local .env
```

Then edit `.env` and add your OpenAI API key:

```
OPENAI_API_KEY=your_openai_api_key_here
```

Run the server:

```bash
npm run dev
```

Your Mastra server and the Playground will be running on `http://localhost:4111`.

## How to experience the agent in action

The recommended way to experience this template is to run the Mastra playground and pass it a link to a PDF.

Here's a chapter from Mastra's book on [principles of building AI agents](https://mastra.ai/book) for you to play with:

```
https://raw.githubusercontent.com/mastra-ai/template-pdf-to-audio/main/media/mcp_chapter.pdf
```

## Features

- **Multiple Voice Options**: Choose from alloy, echo, fable, onyx, nova, shimmer voices
- **Configurable Speech**: Adjust speaking speed from 0.1x to 4.0x
- **Text Naturalizer Agent**: Specialized agent for optimizing text for audio conversion
- **AI Summarization**: Intelligent content compression for focused audio
- **Professional Voice Synthesis**: High-quality TTS using OpenAI's voice models
- **Workflow Orchestration**: Demonstrates chaining tools and agents together
- **PDF Processing**: Download, extract, and process PDF content
- **Voice Capabilities**: Turn agent output into audio streams

## Architecture Overview

### Tools

- **summarizePdfTool**: Downloads PDFs from URLs, extracts text, and generates AI summaries
- **textToSpeechTool**: Generates high-quality audio from text content using voice synthesis

### Agents

- **pdfToAudioAgent**: Complete agent that handles the full PDF to audio pipeline with voice synthesis
- **textNaturalizerAgent**: Specialized in preparing and optimizing text content for audio script generation
- **pdfSummarizationAgent**: Creates concise, comprehensive summaries of PDF content optimized for text-to-speech conversion

### Workflow

- **pdfToAudioWorkflow**: Orchestrates the complete PDF-to-audio conversion process through two main steps: download & summarize, then generate audio
