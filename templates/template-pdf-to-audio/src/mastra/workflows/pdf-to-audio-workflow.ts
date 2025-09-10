import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { RuntimeContext } from '@mastra/core/di';
import { summarizePdfTool } from '../tools/summarize-pdf-tool';
import { textToSpeechTool } from '../tools/text-to-speech-tool';

// Define schemas for input and outputs
const pdfInputSchema = z.object({
  pdfUrl: z.string().describe('URL to a PDF file to download and process'),
  speaker: z.enum(['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']).optional().default('onyx'),
  speed: z.number().min(0.1).max(4).optional().default(1),
});

const pdfSummarySchema = z.object({
  summary: z.string().describe('The AI-generated summary of the PDF content'),
  fileSize: z.number().describe('Size of the downloaded file in bytes'),
  pagesCount: z.number().describe('Number of pages in the PDF'),
  characterCount: z.number().describe('Number of characters extracted from the PDF'),
  speaker: z.enum(['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']).optional().default('onyx'),
  speed: z.number().min(0.1).max(4).optional().default(1),
});

const audioSchema = z.object({
  audioGenerated: z.boolean().describe('Whether audio generation was successful'),
  filePath: z.string().optional().describe('Path to the generated audio file'),
  speaker: z.string().describe('Voice speaker that was used for audio generation'),
  speed: z.number().describe('Speaking speed that was used for audio generation'),
});

// Step 1: Download PDF and generate summary
const downloadAndSummarizePdfStep = createStep({
  id: 'download-and-summarize-pdf',
  description: 'Downloads PDF from URL and generates an AI summary',
  inputSchema: pdfInputSchema,
  outputSchema: pdfSummarySchema,
  execute: async ({ inputData, mastra }) => {
    console.log('Executing Step: download-and-summarize-pdf');
    const { pdfUrl, speaker, speed } = inputData;

    const result = await summarizePdfTool.execute({
      context: { pdfUrl },
      mastra,
      runtimeContext: new RuntimeContext(),
      tracingContext: {} as any,
    });

    console.log(
      `Step download-and-summarize-pdf: Succeeded - Downloaded ${result.fileSize} bytes, extracted ${result.characterCount} characters from ${result.pagesCount} pages, generated ${result.summary.length} character summary`,
    );

    return {
      ...result,
      speaker,
      speed,
    };
  },
});

// Step 2: Generate Audio from Summary
const generateAudioFromSummaryStep = createStep({
  id: 'generate-audio-from-summary',
  description: 'Generates high-quality audio from the AI-generated PDF summary',
  inputSchema: pdfSummarySchema,
  outputSchema: audioSchema,
  execute: async ({ inputData, mastra }) => {
    console.log('Executing Step: generate-audio-from-summary');

    const { summary, speaker, speed } = inputData;

    if (!summary) {
      console.error('Missing summary in audio generation step');
      return {
        audioGenerated: false,
        speaker: speaker,
        speed: speed,
      };
    }

    try {
      const result = await textToSpeechTool.execute({
        context: {
          extractedText: summary, // Use summary as the text input
          speaker,
          speed,
        },
        mastra,
        runtimeContext: new RuntimeContext(),
        tracingContext: {} as any,
      });

      console.log(`Step generate-audio-from-summary: Succeeded - Generated audio: ${result.audioGenerated}`);
      return result;
    } catch (error) {
      console.error('Step generate-audio-from-summary: Failed - Error during generation:', error);
      return {
        audioGenerated: false,
        speaker: speaker,
        speed: speed,
      };
    }
  },
});

// Define the workflow with simplified steps
export const pdfToAudioWorkflow = createWorkflow({
  id: 'generate-audio-from-pdf-workflow',
  description: 'Downloads PDF from URL, generates an AI summary, and creates high-quality audio from the summary',
  inputSchema: pdfInputSchema,
  outputSchema: audioSchema,
})
  .then(downloadAndSummarizePdfStep)
  .then(generateAudioFromSummaryStep)
  .commit();
