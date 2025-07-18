import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

// Define schemas for input and outputs
const csvInputSchema = z.object({
  csvUrl: z.string().describe('URL to a CSV file to download and process'),
});

const questionsSchema = z.object({
  questions: z
    .array(z.string())
    .describe('The generated questions from the CSV content'),
  success: z
    .boolean()
    .describe('Indicates if the question generation was successful'),
});

// Step: Process CSV and Generate Questions
const processCSVAndGenerateQuestionsStep = createStep({
  id: 'process-csv-generate-questions',
  description: 'Uses the CSV agent to fetch CSV data and generate questions',
  inputSchema: csvInputSchema,
  outputSchema: questionsSchema,
  execute: async ({ inputData, mastra }) => {
    console.log('Executing Step: process-csv-generate-questions');
    const { csvUrl } = inputData;

    try {
      const agent = mastra?.getAgent('csvQuestionAgent');
      if (!agent) {
        throw new Error('CSV question generator agent not found');
      }

      console.log('📝 Sending CSV URL to agent for processing and question generation...');

      const streamResponse = await agent.stream([
        {
          role: 'user',
          content: `Please fetch and analyze the CSV data from this URL: ${csvUrl}

Then generate comprehensive questions based on the CSV content that test understanding of:
1. The structure and content of the CSV data
2. Patterns and trends within the data
3. Comparisons between different data points
4. Practical applications and insights from the data
5. Statistical and analytical aspects of the dataset

Generate 5-10 diverse questions that help someone thoroughly understand and analyze this CSV data.`,
        },
      ]);

      let generatedContent = '';
      let chunkCount = 0;

      console.log('📡 Streaming response from agent...');

      try {
        for await (const chunk of streamResponse.textStream) {
          if (chunk) {
            generatedContent += chunk;
            chunkCount++;
          }
        }
      } catch (streamError) {
        console.error('🚨 Error during streaming:', streamError);
        throw streamError;
      }

      console.log(`📊 Received ${chunkCount} chunks, total length: ${generatedContent.length}`);
      console.log(`📋 Generated content preview: ${generatedContent.substring(0, 200)}...`);

      if (generatedContent.trim().length > 20) {
        // Parse the questions from the generated content
        const questions = parseQuestionsFromText(generatedContent);

        console.log(
          `Step process-csv-generate-questions: Succeeded - Generated ${questions.length} questions`
        );
        return { questions, success: true };
      } else {
        console.warn(
          `Step process-csv-generate-questions: Failed - Generated content too short (${generatedContent.length} chars)`
        );
        console.warn('Generated content:', generatedContent);

        // Check if OpenAI API key is set
        if (!process.env.OPENAI_API_KEY) {
          console.error('🚨 OPENAI_API_KEY environment variable is not set!');
          console.error('Please set your OpenAI API key: export OPENAI_API_KEY="your-api-key"');
        }

        return { questions: [], success: false };
      }
    } catch (error) {
      console.error(
        'Step process-csv-generate-questions: Failed - Error during processing:',
        error
      );

      // Check for common API errors
      if (error instanceof Error) {
        if (error.message.includes('401')) {
          console.error('🚨 Authentication error - check your OpenAI API key');
        } else if (error.message.includes('429')) {
          console.error('🚨 Rate limit exceeded - please try again later');
        } else if (error.message.includes('insufficient_quota')) {
          console.error('🚨 OpenAI API quota exceeded - check your billing');
        }
      }

      return { questions: [], success: false };
    }
  },
});

// Helper function to parse questions from generated text
function parseQuestionsFromText(text: string): string[] {
  // Split by common question patterns and clean up
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => line.includes('?') || line.match(/^\d+[\.\)]/)); // Question marks or numbered items

  // Extract actual questions
  const questions = lines
    .map((line) => {
      // Remove numbering patterns like "1.", "1)", etc.
      let cleaned = line.replace(/^\d+[\.\)]\s*/, '');
      // Remove bullet points
      cleaned = cleaned.replace(/^[\-\*\•]\s*/, '');
      return cleaned.trim();
    })
    .filter((q) => q.length > 5) // Filter out very short strings
    .slice(0, 10); // Limit to 10 questions

  return questions;
}

// Define the workflow with a single step that uses the agent
export const csvToQuestionsWorkflow = createWorkflow({
  id: 'csv-to-questions',
  description:
    'Uses the CSV agent to fetch CSV data from URL and generate questions from the content',
  inputSchema: csvInputSchema,
  outputSchema: questionsSchema,
})
  .then(processCSVAndGenerateQuestionsStep)
  .commit();
