import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { RuntimeContext } from '@mastra/core/di';
import { downloadPdfTool } from '../tools/download-pdf-tool';
import { generateAudioFromTextTool } from '../tools/generate-audio-from-text-tool';

// Define schemas for input and outputs
const pdfInputSchema = z.object({
  pdfUrl: z.string().describe('URL to a PDF file to download and process'),
  voice: z.string().optional().describe('Voice to use for audio generation (alloy, echo, fable, onyx, nova, shimmer)'),
  speed: z.number().optional().describe('Speech speed (0.25-4.0, default: 1.0)'),
});

const pdfSummarySchema = z.object({
  summary: z.string().describe('The AI-generated audio-friendly summary of the PDF content'),
  fileSize: z.number().describe('Size of the downloaded file in bytes'),
  pagesCount: z.number().describe('Number of pages in the PDF'),
  characterCount: z.number().describe('Number of characters extracted from the PDF'),
});

const audioOutputSchema = z.object({
  audioStream: z.any().describe('Audio stream containing the generated speech'),
  summary: z.string().describe('The text summary that was converted to audio'),
  duration: z.number().optional().describe('Estimated duration of the audio in seconds'),
  voice: z.string().describe('Voice used for the audio generation'),
  pdfInfo: z
    .object({
      fileSize: z.number().describe('Size of the original PDF in bytes'),
      pagesCount: z.number().describe('Number of pages in the PDF'),
      characterCount: z.number().describe('Number of characters extracted from the PDF'),
    })
    .describe('Information about the processed PDF'),
  success: z.boolean().describe('Indicates if the entire process was successful'),
});

// Step 1: Download PDF and generate audio-friendly summary
const downloadAndSummarizePdfStep = createStep({
  id: 'download-and-summarize-pdf',
  description: 'Downloads PDF from URL and generates an audio-friendly summary',
  inputSchema: pdfInputSchema,
  outputSchema: pdfSummarySchema,
  execute: async ({ inputData, mastra, runtimeContext }) => {
    console.log('Executing Step: download-and-summarize-pdf');
    const { pdfUrl } = inputData;

    const result = await downloadPdfTool.execute({
      context: { pdfUrl },
      mastra,
      runtimeContext: runtimeContext || new RuntimeContext(),
    });

    console.log(
      `Step download-and-summarize-pdf: Succeeded - Downloaded ${result.fileSize} bytes, extracted ${result.characterCount} characters from ${result.pagesCount} pages, generated ${result.summary.length} character audio-friendly summary`,
    );

    return result;
  },
});

// Step 2: Generate Audio from Summary
const generateAudioFromSummaryStep = createStep({
  id: 'generate-audio-from-summary',
  description: 'Converts the audio-friendly summary into high-quality speech audio',
  inputSchema: pdfSummarySchema.extend({
    voice: z.string().optional(),
    speed: z.number().optional(),
  }),
  outputSchema: audioOutputSchema,
  execute: async ({ inputData, mastra, runtimeContext }) => {
    console.log('Executing Step: generate-audio-from-summary');

    const { summary, fileSize, pagesCount, characterCount, voice, speed } = inputData;

    if (!summary) {
      console.error('Missing summary in audio generation step');
      return {
        audioStream: null,
        summary: '',
        duration: 0,
        voice: voice || 'alloy',
        pdfInfo: { fileSize, pagesCount, characterCount },
        success: false,
      };
    }

    try {
      const result = await generateAudioFromTextTool.execute({
        context: {
          text: summary,
          voice: voice || 'alloy',
          speed: speed || 1.0,
        },
        mastra,
        runtimeContext: runtimeContext || new RuntimeContext(),
      });

      if (!result.success) {
        throw new Error('Audio generation failed');
      }

      console.log(
        `Step generate-audio-from-summary: Succeeded - Generated audio from ${summary.length} character summary using voice "${result.voice}"`,
      );

      return {
        audioStream: result.audioStream,
        summary: summary,
        duration: result.duration,
        voice: result.voice,
        pdfInfo: {
          fileSize,
          pagesCount,
          characterCount,
        },
        success: true,
      };
    } catch (error) {
      console.error('Step generate-audio-from-summary: Failed - Error during audio generation:', error);
      return {
        audioStream: null,
        summary: summary,
        duration: 0,
        voice: voice || 'alloy',
        pdfInfo: { fileSize, pagesCount, characterCount },
        success: false,
      };
    }
  },
});

// Define the workflow
export const pdfToAudioWorkflow = createWorkflow({
  id: 'pdf-to-audio-workflow',
  description:
    'Downloads PDF from URL, generates an audio-friendly summary, and converts it to high-quality speech audio',
  inputSchema: pdfInputSchema,
  outputSchema: audioOutputSchema,
})
  .then(downloadAndSummarizePdfStep)
  .then(generateAudioFromSummaryStep)
  .commit();
