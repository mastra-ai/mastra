import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { RequestContext } from '@mastra/core/di';
import { csvFetcherTool } from '../tools/download-csv-tool';
import { generateQuestionsFromTextTool } from '../tools/generate-questions-from-text-tool';

// Define schemas for input and outputs
const csvInputSchema = z.object({
  csvUrl: z.string().describe('URL to a CSV file to download and process'),
});

const csvSummarySchema = z.object({
  summary: z.string().describe('The AI-generated summary of the CSV data'),
  fileSize: z.number().describe('Size of the downloaded file in bytes'),
  rowCount: z.number().describe('Number of rows in the CSV'),
  columnCount: z.number().describe('Number of columns in the CSV'),
  characterCount: z.number().describe('Number of characters in the original CSV'),
});

const questionsSchema = z.object({
  questions: z.array(z.string()).describe('The generated questions from the CSV content'),
  success: z.boolean().describe('Indicates if the question generation was successful'),
});

// Step 1: Download CSV and generate summary
const downloadAndSummarizeCSVStep = createStep({
  id: 'download-and-summarize-csv',
  description: 'Downloads CSV from URL and generates an AI summary',
  inputSchema: csvInputSchema,
  outputSchema: csvSummarySchema,
  execute: async ({ inputData, mastra, requestContext }) => {
    console.log('Executing Step: download-and-summarize-csv');
    const { csvUrl } = inputData;

    const result = await csvFetcherTool.execute({
      context: { csvUrl },
      mastra,
      requestContext: requestContext || new RequestContext(),
    });

    console.log(
      `Step download-and-summarize-csv: Succeeded - Downloaded ${result.fileSize} bytes, extracted ${result.characterCount} characters from ${result.rowCount} rows and ${result.columnCount} columns, generated ${result.summary.length} character summary`,
    );

    return result;
  },
});

// Step 2: Generate Questions from Summary
const generateQuestionsFromSummaryStep = createStep({
  id: 'generate-questions-from-summary',
  description: 'Generates questions from the AI-generated CSV summary',
  inputSchema: csvSummarySchema,
  outputSchema: questionsSchema,
  execute: async ({ inputData, mastra, requestContext }) => {
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
        requestContext: requestContext || new RequestContext(),
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
export const csvToQuestionsWorkflow = createWorkflow({
  id: 'csv-to-questions',
  description: 'Downloads CSV from URL, generates an AI summary, and creates questions from the summary',
  inputSchema: csvInputSchema,
  outputSchema: questionsSchema,
})
  .then(downloadAndSummarizeCSVStep)
  .then(generateQuestionsFromSummaryStep)
  .commit();
