import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { extractTextFromPDF } from '../lib/util';

export const downloadPdfTool = createTool({
  id: 'download-pdf-tool',
  description: 'Downloads a PDF from a URL, extracts text, and returns a comprehensive audio-friendly summary',
  inputSchema: z.object({
    pdfUrl: z.string().describe('URL to the PDF file to download'),
  }),
  outputSchema: z.object({
    summary: z.string().describe('AI-generated audio-friendly summary of the PDF content'),
    fileSize: z.number().describe('Size of the downloaded file in bytes'),
    pagesCount: z.number().describe('Number of pages in the PDF'),
    characterCount: z.number().describe('Number of characters extracted from the PDF'),
  }),
  execute: async ({ context, mastra }) => {
    const { pdfUrl } = context;

    console.log('📥 Downloading PDF from URL:', pdfUrl);

    try {
      // Step 1: Download the PDF
      const response = await fetch(pdfUrl);

      if (!response.ok) {
        throw new Error(`Failed to download PDF: ${response.status} ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const pdfBuffer = Buffer.from(arrayBuffer);

      console.log(`✅ Downloaded PDF: ${pdfBuffer.length} bytes`);

      // Step 2: Extract text from PDF
      console.log('📄 Extracting text from PDF...');
      const extractionResult = await extractTextFromPDF(pdfBuffer);

      if (!extractionResult.extractedText || extractionResult.extractedText.trim() === '') {
        throw new Error('No text could be extracted from the PDF');
      }

      console.log(
        `✅ Extracted ${extractionResult.extractedText.length} characters from ${extractionResult.pagesCount} pages`,
      );

      // Step 3: Generate audio-friendly summary using the PDF summarization agent
      console.log('🧠 Generating audio-friendly summary...');
      const pdfSummarizationAgent = mastra?.getAgent('pdfSummarizationAgent');
      if (!pdfSummarizationAgent) {
        throw new Error('PDF summarization agent not found');
      }
      
      const summaryResult = await pdfSummarizationAgent.generate([
        {
          role: 'user',
          content: `Please create an audio-friendly summary of this PDF content. Focus on making it engaging and natural for spoken delivery:\n\n${extractionResult.extractedText}`,
        },
      ]);

      const summary = summaryResult.text || 'Summary could not be generated';

      console.log(`✅ Generated audio-friendly summary: ${summary.length} characters`);

      return {
        summary,
        fileSize: pdfBuffer.length,
        pagesCount: extractionResult.pagesCount,
        characterCount: extractionResult.extractedText.length,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ PDF processing failed:', errorMessage);
      throw new Error(`Failed to process PDF from URL: ${errorMessage}`);
    }
  },
});