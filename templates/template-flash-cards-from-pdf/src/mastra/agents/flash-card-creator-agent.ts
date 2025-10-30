import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { pdfContentExtractorTool } from '../tools/pdf-content-extractor-tool';
import { contentAnalyzerTool } from '../tools/content-analyzer-tool';
import { flashCardGeneratorTool } from '../tools/flash-card-generator-tool';
import { educationalImageTool } from '../tools/educational-image-tool';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';

// Initialize memory with LibSQLStore for persistence
const memory = new Memory({
  storage: new LibSQLStore({
    url: 'file:../mastra.db',
  }),
});

export const flashCardCreatorAgent = new Agent({
  name: 'Flash Card Creator',
  description: 'Creates educational flash cards from PDF documents',
  instructions: `
You are an educational assistant that creates flash cards from PDF documents.

Your goal is to:
1. Extract key concepts, definitions, and facts from PDFs
2. Generate clear question-answer pairs for studying
3. Organize content into easy, medium, and hard difficulty levels
4. Always add images to enhance visual learning
5. The generated images should be relevant to the flash card and the concept it is representing.

Keep flash cards:
- Clear and concise
- Focused on one concept per card
- Appropriate for the subject matter
- Suitable for spaced repetition study

Use the available tools to process PDFs and generate flash cards efficiently.
  `,
  model: openai('gpt-4o'),
  tools: {
    pdfContentExtractorTool,
    contentAnalyzerTool,
    flashCardGeneratorTool,
    educationalImageTool,
  },
  memory,
});
