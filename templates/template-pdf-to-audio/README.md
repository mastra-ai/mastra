# PDF to Audio Template

A Mastra template that processes PDF files and converts them into playable audio summaries using OpenAI GPT-4o for summarization and text-to-speech. Features pure JavaScript PDF parsing with no system dependencies and voice synthesis capabilities.

## Features

- **PDF Processing**: Downloads and extracts text from PDF files using pure JavaScript
- **Audio-Friendly Summarization**: Creates engaging, conversational summaries optimized for audio consumption
- **High-Quality Text-to-Speech**: Converts summaries to natural-sounding speech using OpenAI's TTS
- **Multiple Voice Options**: Choose from various voice personalities (alloy, echo, fable, onyx, nova, shimmer)
- **Configurable Speech Speed**: Adjust playback speed for optimal listening experience
- **Workflow-Based Architecture**: Modular design with reusable components

## Prerequisites

- Node.js >= 20.9.0
- OpenAI API key for both GPT-4o and TTS services
- pnpm package manager

## Setup

1. Install dependencies:
```bash
pnpm install
```

2. Set your OpenAI API key:
```bash
export OPENAI_API_KEY="your-openai-api-key-here"
```

## Usage

### Interactive Chat Agent (Mastra Playground)

The easiest way to use this template is through the **PDF to Audio Chat Agent** in the Mastra playground:

1. Start the development server:
```bash
pnpm dev
```

2. Open the Mastra playground in your browser

3. Select the "PDF to Audio Chat Agent" 

4. Chat with the agent to convert PDFs:
```
You: Can you convert this PDF to audio: https://example.com/document.pdf

Agent: I'll help you convert that PDF to audio! Let me download and process it first, then create an audio summary for you.

[Agent processes the PDF and generates audio]

Agent: Great! I've successfully converted your PDF to audio. The document was 15 pages and I've created a 3-minute audio summary using the 'alloy' voice at normal speed. Would you like me to use a different voice or adjust the speed?

You: Can you make it faster and use a more energetic voice?

Agent: Sure! Let me regenerate that with the 'nova' voice at 1.5x speed for a more energetic and faster delivery.
```

The chat agent can:
- Process PDF URLs you provide
- Generate audio-friendly summaries
- Create high-quality speech audio
- Customize voice and speed based on your preferences
- Handle errors gracefully with helpful suggestions

### Using the Workflow

```typescript
import { mastra } from './src/mastra';

// Convert a PDF to audio
const result = await mastra.workflow.pdfToAudioWorkflow.run({
  pdfUrl: "https://example.com/document.pdf",
  voice: "alloy",    // Optional: choose voice (alloy, echo, fable, onyx, nova, shimmer)
  speed: 1.0         // Optional: speech speed (0.25-4.0)
});

// The result contains:
// - audioStream: NodeJS.ReadableStream with the generated audio
// - summary: The text summary that was converted to audio
// - duration: Estimated audio duration in seconds
// - voice: Voice used for generation
// - pdfInfo: Original PDF metadata
// - success: Boolean indicating if process succeeded
```

### Using Individual Tools

```typescript
import { downloadPdfTool, generateAudioFromTextTool } from './src/mastra/tools';
import { mastra } from './src/mastra';

// Step 1: Download and summarize PDF
const pdfResult = await downloadPdfTool.execute({
  context: { pdfUrl: "https://example.com/document.pdf" },
  mastra,
});

// Step 2: Convert summary to audio
const audioResult = await generateAudioFromTextTool.execute({
  context: { 
    text: pdfResult.summary,
    voice: "nova",
    speed: 1.2
  },
  mastra,
});
```

### Using Agents Directly

```typescript
import { pdfSummarizationAgent, audioGenerationAgent } from './src/mastra/agents';

// Generate an audio-friendly summary
const summaryResult = await pdfSummarizationAgent.generate([
  {
    role: 'user',
    content: 'Please create an audio-friendly summary of this content: [your text here]'
  }
]);

// The audioGenerationAgent has voice capabilities built-in
const audioStream = await audioGenerationAgent.voice.speak(summaryResult.text, {
  speaker: "fable",
  speed: 0.9
});
```

## Available Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build the application  
- `pnpm start` - Start production server

## Voice Options

The template supports the following OpenAI voices:

- **alloy** - Neutral, balanced voice
- **echo** - Clear, crisp pronunciation  
- **fable** - Warm, storytelling voice
- **onyx** - Deep, authoritative voice
- **nova** - Young, energetic voice
- **shimmer** - Bright, enthusiastic voice

## Speed Settings

Speech speed can be adjusted from 0.25x to 4.0x:
- **0.25-0.75**: Slow, good for complex content
- **1.0**: Normal speaking pace (default)
- **1.25-1.5**: Slightly faster, efficient listening
- **1.75-4.0**: Very fast, for quick consumption

## Architecture

### Components

- **PDF to Audio Chat Agent**: Interactive agent for playground chat interface (combines all functionality)
- **PDF Summarization Agent**: Creates audio-optimized summaries from PDF content
- **Audio Generation Agent**: Handles text-to-speech conversion with voice configuration
- **Download PDF Tool**: Downloads PDFs and extracts text using pure JavaScript
- **Generate Audio Tool**: Converts text to high-quality audio streams
- **PDF to Audio Workflow**: Orchestrates the complete process from PDF to audio

### Data Flow

1. PDF URL → Download PDF Tool → Extract text and generate summary
2. Summary → Generate Audio Tool → Convert to speech using OpenAI TTS
3. Return audio stream along with metadata and summary text

## Error Handling

The template includes comprehensive error handling:
- Invalid PDF URLs or download failures
- PDF parsing errors (empty files, corrupted content)
- Text extraction failures
- Audio generation errors
- API key validation and quota limits

## Limitations

- PDF files must be publicly accessible via URL
- Maximum text length depends on OpenAI's TTS limits
- Audio generation requires internet connection
- Some PDF formats may not extract text properly

## Contributing

This template demonstrates Mastra's capabilities for document processing and voice synthesis. Feel free to extend it with:
- Additional voice providers
- Different document formats
- Custom summarization styles
- Audio post-processing features
- Batch processing capabilities

## License

ISC