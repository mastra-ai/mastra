import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { RuntimeContext } from '@mastra/core/di';
import { pdfFetcherTool } from '../tools/download-pdf-tool';
import { generateAudioFromTextTool } from '../tools/generate-audio-from-text-tool';

// Define schemas for input and outputs
const pdfInputSchema = z.object({
  pdfUrl: z.string().describe('URL to a PDF file to download and process'),
  speaker: z.string().optional().describe('Voice speaker to use for audio generation (default: nova)'),
  speed: z.number().optional().describe('Speaking speed for audio generation (0.25 to 4.0, default: 1.0)'),
});

const pdfSummarySchema = z.object({
  summary: z.string().describe('The AI-generated summary of the PDF content'),
  fileSize: z.number().describe('Size of the downloaded file in bytes'),
  pagesCount: z.number().describe('Number of pages in the PDF'),
  characterCount: z.number().describe('Number of characters extracted from the PDF'),
  speaker: z.string().optional().describe('Voice speaker for audio generation'),
  speed: z.number().optional().describe('Speaking speed for audio generation'),
});

const audioSchema = z.object({
  audioGenerated: z.boolean().describe('Whether audio generation was successful'),
  textLength: z.number().describe('Length of text processed for audio'),
  estimatedDuration: z.number().describe('Estimated audio duration in seconds'),
  audioInfo: z.object({
    format: z.string().describe('Audio format'),
    quality: z.string().describe('Audio quality setting'),
    speaker: z.string().describe('Voice speaker used'),
  }),
  success: z.boolean().describe('Indicates if the audio generation was successful'),
});

// Step 1: Download PDF and generate summary
const downloadAndSummarizePdfStep = createStep({
  id: 'download-and-summarize-pdf',
  description: 'Downloads PDF from URL and generates an AI summary',
  inputSchema: pdfInputSchema,
  outputSchema: pdfSummarySchema,
  execute: async ({ inputData, mastra, runtimeContext }) => {
    console.log('Executing Step: download-and-summarize-pdf');
    const { pdfUrl, speaker, speed } = inputData;

    const result = await pdfFetcherTool.execute({
      context: { pdfUrl },
      mastra,
      runtimeContext: runtimeContext || new RuntimeContext(),
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
  execute: async ({ inputData, mastra, runtimeContext }) => {
    console.log('Executing Step: generate-audio-from-summary');

    const { summary, speaker = 'nova', speed = 1.0 } = inputData;

    if (!summary) {
      console.error('Missing summary in audio generation step');
      return {
        audioGenerated: false,
        textLength: 0,
        estimatedDuration: 0,
        audioInfo: {
          format: 'none',
          quality: 'none',
          speaker: 'none',
        },
        success: false,
      };
    }

    try {
      const result = await generateAudioFromTextTool.execute({
        context: {
          extractedText: summary, // Use summary as the text input
          speaker,
          speed,
        },
        mastra,
        runtimeContext: runtimeContext || new RuntimeContext(),
      });

      console.log(
        `Step generate-audio-from-summary: Succeeded - Generated audio from ${result.textLength} characters, estimated duration: ${result.estimatedDuration} seconds`,
      );
      return result;
    } catch (error) {
      console.error('Step generate-audio-from-summary: Failed - Error during generation:', error);
      return {
        audioGenerated: false,
        textLength: 0,
        estimatedDuration: 0,
        audioInfo: {
          format: 'none',
          quality: 'none',
          speaker: 'none',
        },
        success: false,
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
