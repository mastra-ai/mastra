# PDF to Audio Generator

A Mastra template that demonstrates **how to convert PDF documents to high-quality audio** using AI summarization and voice synthesis. Features pure JavaScript PDF parsing, AI-powered text summarization, and text-to-speech conversion with configurable voice options.

> **🎯 Key Learning**: This template shows how to use large context window models for PDF summarization combined with voice synthesis to create accessible audio content from documents, enabling efficient audio consumption of written materials.

## Overview

This template showcases a powerful workflow for making PDF documents accessible through audio:

**🚨 The Problem**: PDF documents can be difficult to consume when you're multitasking, have accessibility needs, or prefer audio learning.

**✅ The Solution**: Use AI to extract and summarize PDF content, then convert it to natural-sounding audio using voice synthesis.

### Workflow

1. **Input**: PDF URL + Voice preferences (speaker, speed)
2. **Download & Summarize**: Fetch PDF, extract text, and generate AI summary using OpenAI GPT-4.1 Mini
3. **Generate Audio**: Convert the summary to high-quality audio using voice synthesis

### Key Benefits

- **🎧 Audio Accessibility**: Convert any PDF to audio for listening on-the-go
- **📉 Content Compression**: AI summarization creates focused audio from key insights
- **🎙️ Professional Quality**: High-definition voice synthesis with multiple speaker options
- **⚡ Fast Processing**: Efficient PDF processing and audio generation
- **🔧 Configurable**: Choose voice characteristics and speaking speed

## Prerequisites

- Node.js 20.9.0 or higher
- OpenAI API key (for both summarization and voice synthesis)

## Setup

1. **Clone and install dependencies:**

   ```bash
   git clone <repository-url>
   cd template-pdf-to-audio
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

## 🏗️ Architectural Pattern: PDF to Audio Pipeline

This template demonstrates a comprehensive approach to document-to-audio conversion:

### The Challenge

When working with PDF documents, you often encounter:

- **Accessibility barriers**: PDFs can be difficult to consume with screen readers
- **Multitasking needs**: Want to consume content while doing other activities
- **Learning preferences**: Some people learn better through audio
- **Large documents**: Long PDFs are time-consuming to read
- **Mobile consumption**: PDFs are hard to read on small screens

### The Solution: AI-Powered Audio Generation

Instead of manual audio recording or basic text-to-speech:

1. **Use AI summarization** to extract key information from large documents
2. **Apply professional voice synthesis** to create natural-sounding audio
3. **Provide configurable options** for voice characteristics and speed
4. **Optimize for audio consumption** with proper pacing and clarity

### Implementation Details

```typescript
// ❌ BAD: Basic TTS on raw PDF text
const audio = await textToSpeech(fullPdfText); // Poor quality, too long

// ✅ GOOD: AI summary + professional voice synthesis
const summary = await summarizeWithGPT41Mini(fullPdfText);
const audio = await agent.voice.speak(summary, { speaker: 'nova', speed: 1.0 });
```

### When to Use This Pattern

- **Document accessibility**: Making PDFs accessible to visually impaired users
- **Mobile consumption**: Converting documents for listening during commutes
- **Learning content**: Educational materials for audio learners
- **Content repurposing**: Converting written content to podcast-style audio
- **Productivity**: Consuming business documents while multitasking

## Usage

### Using the Workflow

```typescript
import { mastra } from './src/mastra/index';

const run = await mastra.getWorkflow('pdfToAudioWorkflow').createRunAsync();

// Generate audio from PDF with custom voice settings
const result = await run.start({
  inputData: {
    pdfUrl: 'https://example.com/document.pdf',
    speaker: 'nova', // Choose voice: alloy, echo, fable, onyx, nova, shimmer
    speed: 1.2, // Speaking speed (0.25 to 4.0)
  },
});

console.log(result.result.audioInfo);
```

### Using the PDF to Audio Agent

```typescript
import { mastra } from './src/mastra/index';

const agent = mastra.getAgent('pdfToAudioAgent');

// The agent can handle the full process with natural language
const response = await agent.stream([
  {
    role: 'user',
    content:
      'Please download this PDF and convert it to audio using a professional voice: https://example.com/document.pdf',
  },
]);

for await (const chunk of response.textStream) {
  console.log(chunk);
}

// Use agent's built-in voice capabilities for immediate audio
const audioStream = await agent.voice.speak('This is a test of the voice capabilities');
```

### Using Individual Tools

```typescript
import { mastra } from './src/mastra/index';
import { pdfFetcherTool } from './src/mastra/tools/download-pdf-tool';
import { generateAudioFromTextTool } from './src/mastra/tools/generate-audio-from-text-tool';

// Step 1: Download PDF and generate summary
const pdfResult = await pdfFetcherTool.execute({
  context: { pdfUrl: 'https://example.com/document.pdf' },
  mastra,
  runtimeContext: new RuntimeContext(),
});

console.log(`Downloaded ${pdfResult.fileSize} bytes from ${pdfResult.pagesCount} pages`);
console.log(`Generated ${pdfResult.summary.length} character summary`);

// Step 2: Generate audio from summary
const audioResult = await generateAudioFromTextTool.execute({
  context: {
    extractedText: pdfResult.summary,
    speaker: 'nova',
    speed: 1.0,
  },
  mastra,
  runtimeContext: new RuntimeContext(),
});

console.log(`Audio generated: ${audioResult.estimatedDuration} seconds duration`);
```

### Expected Output

```javascript
{
  audioGenerated: true,
  textLength: 1245,
  estimatedDuration: 124,
  audioInfo: {
    format: 'mp3',
    quality: 'hd',
    speaker: 'nova'
  },
  success: true
}
```

## Architecture

### Components

- **`pdfToAudioWorkflow`**: Main workflow orchestrating the PDF-to-audio conversion
- **`textToAudioAgent`**: Mastra agent specialized in text-to-audio conversion with voice capabilities
- **`pdfToAudioAgent`**: Complete agent that handles the full PDF to audio pipeline with voice synthesis
- **`pdfSummarizationAgent`**: Enhanced summarization agent with voice capabilities for audio-optimized summaries

### Tools

- **`pdfFetcherTool`**: Downloads PDF files from URLs, extracts text, and generates AI summaries
- **`generateAudioFromTextTool`**: Generates high-quality audio from text content using voice synthesis

### Workflow Steps

1. **`download-and-summarize-pdf`**: Downloads PDF from provided URL and generates AI summary optimized for audio
2. **`generate-audio-from-summary`**: Creates high-quality audio from the AI summary using voice synthesis

## Features

- ✅ **Professional Voice Synthesis**: High-quality TTS using OpenAI's voice models
- ✅ **Multiple Voice Options**: Choose from alloy, echo, fable, onyx, nova, shimmer voices
- ✅ **Configurable Speech**: Adjust speaking speed from 0.25x to 4.0x
- ✅ **AI Summarization**: Intelligent content compression for focused audio
- ✅ **Token Limit Protection**: Efficient processing of large documents
- ✅ **Zero System Dependencies**: Pure JavaScript solution
- ✅ **Accessibility Focused**: Makes PDFs accessible through audio
- ✅ **Multiple Interfaces**: Workflow, Agent, and individual tools available
- ✅ **Real-time Voice**: Agents support live voice interaction

## Voice Configuration

### Available Voices

- **alloy**: Neutral, balanced voice
- **echo**: Friendly, conversational tone
- **fable**: Warm, expressive voice
- **onyx**: Deep, authoritative voice
- **nova**: Clear, professional voice (recommended for documents)
- **shimmer**: Bright, energetic voice

### Speed Settings

- **0.25**: Very slow (accessibility)
- **0.5**: Slow (complex content)
- **1.0**: Normal speed (default)
- **1.5**: Fast (familiar content)
- **2.0**: Very fast (review/scanning)

## How It Works

### Text Extraction Strategy

This template uses a **pure JavaScript approach** for PDF processing:

1. **Text-based PDFs** (90% of cases): Direct text extraction using `pdf2json`
   - ⚡ Fast and reliable
   - 🔧 No system dependencies
   - ✅ Works out of the box

2. **AI Summarization**: Uses OpenAI GPT-4.1 Mini for intelligent content compression

3. **Voice Synthesis**: High-quality TTS using OpenAI's voice models

### Why This Approach?

- **Accessibility**: Makes content available to visually impaired users
- **Flexibility**: Choose voice characteristics and speed
- **Quality**: Professional-grade audio output
- **Efficiency**: AI summarization reduces audio length while preserving key information
- **Integration**: Built into Mastra agents for seamless voice interaction

## Configuration

### Environment Variables

```bash
OPENAI_API_KEY=your_openai_api_key_here
```

### Voice Customization

You can customize voice settings in agents:

```typescript
export const textToAudioAgent = new Agent({
  // ... other config
  voice: new OpenAIVoice({
    speechModel: {
      name: 'tts-1-hd', // or 'tts-1' for faster, lower quality
      apiKey: process.env.OPENAI_API_KEY,
    },
    speaker: 'nova', // Default voice
  }),
});
```

## Development

### Project Structure

```text
src/mastra/
├── agents/
│   ├── pdf-to-audio-agent.ts         # PDF processing and audio generation agent
│   ├── text-to-audio-agent.ts        # Text to audio conversion agent
│   └── pdf-summarization-agent.ts    # PDF summarization agent with voice
├── tools/
│   ├── download-pdf-tool.ts           # PDF download and summarization tool
│   └── generate-audio-from-text-tool.ts # Audio generation tool
├── workflows/
│   └── generate-audio-from-pdf-workflow.ts # Main workflow
├── lib/
│   └── util.ts                        # PDF text extraction utilities
└── index.ts                           # Mastra configuration
```

## Common Issues

### "OPENAI_API_KEY is not set"

- Make sure you've set the environment variable
- Check that your API key is valid and has sufficient credits
- Ensure your account has access to voice synthesis features

### "Failed to download PDF"

- Verify the PDF URL is accessible and publicly available
- Check network connectivity
- Ensure the URL points to a valid PDF file

### "Audio generation failed"

- Check that OpenAI voice models are available in your region
- Verify your API key has access to TTS features
- Try a different voice or speed setting

### "No text could be extracted"

- The PDF might be password-protected
- Scanned PDFs without embedded text won't work
- Very large PDFs might need additional processing time

## What Makes This Template Special

### 🎧 **Audio-First Design**

- Optimized for audio consumption with proper pacing
- Professional voice synthesis with multiple options
- Real-time voice capabilities in agents
- Accessibility-focused implementation

### ⚡ **Intelligent Processing**

- AI summarization for focused content
- Smart text optimization for audio delivery
- Efficient PDF processing pipeline
- Quality control for audio output

### 🔧 **Developer-Friendly**

- Pure JavaScript/TypeScript implementation
- Easy voice configuration and customization
- Clear separation of concerns
- Built-in Mastra voice integration

### 📚 **Accessibility Impact**

- Makes PDFs accessible to visually impaired users
- Enables multitasking and mobile consumption
- Supports different learning preferences
- Professional audio quality output

## 🚀 Broader Applications

This PDF-to-audio pattern can be applied to many scenarios:

### Content Accessibility

- **Educational materials**: Convert textbooks and papers to audio
- **Business documents**: Make reports accessible during commutes
- **Legal documents**: Create audio versions of contracts and policies
- **Technical manuals**: Convert documentation to audio guides

### Content Repurposing

- **Blog posts**: Convert articles to podcast-style content
- **Research papers**: Create audio summaries for quick review
- **Training materials**: Convert written training to audio courses
- **Documentation**: Make technical docs consumable while coding

### Implementation Tips

- Use **nova voice** for clear, professional document reading
- Adjust **speed settings** based on content complexity
- **Summarize first** for long documents to create focused audio
- **Test different voices** to find the best fit for your content type

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
