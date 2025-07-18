import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { RuntimeContext } from '@mastra/core/di';
import { pdfFetcherTool } from '../tools/download-pdf-tool';
import { generateQuestionsFromTextTool } from '../tools/generate-questions-from-text-tool';

// Define schemas for input and outputs
const pdfInputSchema = z.object({
  pdfUrl: z.string().describe('URL to a PDF file to download and process'),
});

const pdfSummarySchema = z.object({
  summary: z.string().describe('The AI-generated summary of the PDF content'),
  fileSize: z.number().describe('Size of the downloaded file in bytes'),
  pagesCount: z.number().describe('Number of pages in the PDF'),
  characterCount: z.number().describe('Number of characters extracted from the PDF'),
});

const questionsSchema = z.object({
  questions: z.array(z.string()).describe('The generated questions from the PDF content'),
  success: z.boolean().describe('Indicates if the question generation was successful'),
});

// Step 1: Download PDF and generate summary
const downloadAndSummarizePdfStep = createStep({
  id: 'download-and-summarize-pdf',
  description: 'Downloads PDF from URL and generates an AI summary',
  inputSchema: pdfInputSchema,
  outputSchema: pdfSummarySchema,
  execute: async ({ inputData, mastra, runtimeContext }) => {
    console.log('Executing Step: download-and-summarize-pdf');
    const { pdfUrl } = inputData;

    const result = await pdfFetcherTool.execute({
      context: { pdfUrl },
      mastra,
      runtimeContext: runtimeContext || new RuntimeContext(),
    });

    console.log(
      `Step download-and-summarize-pdf: Succeeded - Downloaded ${result.fileSize} bytes, extracted ${result.characterCount} characters from ${result.pagesCount} pages, generated ${result.summary.length} character summary`,
    );

    return result;
  },
});

// Step 2: Generate Questions from Summary
const generateQuestionsFromSummaryStep = createStep({
  id: 'generate-questions-from-summary',
  description: 'Generates questions from the AI-generated PDF summary',
  inputSchema: pdfSummarySchema,
  outputSchema: questionsSchema,
  execute: async ({ inputData, mastra, runtimeContext }) => {
    console.log('Executing Step: generate-questions-from-summary');

    const { summary } = inputData;

    if (!summary) {
      console.error('Missing summary in question generation step');
      return { questions: [], success: false };
    }

    try {
      const result = await generateQuestionsFromTextTool.execute({
        context: { extractedText: summary }, // Use summary as the text input
        mastra,
        runtimeContext: runtimeContext || new RuntimeContext(),
      });

      console.log(
        `Step generate-questions-from-summary: Succeeded - Generated ${result.questions.length} questions from summary`,
      );
      return { questions: result.questions, success: result.success };
    } catch (error) {
      console.error('Step generate-questions-from-summary: Failed - Error during generation:', error);
      return { questions: [], success: false };
    }
  },
});

// Define the workflow with simplified steps
export const pdfToQuestionsWorkflow = createWorkflow({
  id: 'generate-questions-from-pdf-workflow',
  description: 'Downloads PDF from URL, generates an AI summary, and creates questions from the summary',
  inputSchema: pdfInputSchema,
  outputSchema: questionsSchema,
})
  .then(downloadAndSummarizePdfStep)
  .then(generateQuestionsFromSummaryStep)
  .commit();
