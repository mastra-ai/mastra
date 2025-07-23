import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { extractTextFromPDF } from '../lib/pdf-utils';

export const pdfContentExtractorTool = createTool({
  id: 'pdf-content-extractor',
  description: 'Downloads a PDF from a URL, extracts content, and creates a marketing-focused summary',
  inputSchema: z.object({
    pdfUrl: z.string().describe('URL to the PDF file to download'),
    focusAreas: z
      .array(z.string())
      .optional()
      .describe('Specific areas to focus on (e.g., "benefits", "features", "pricing")'),
  }),
  outputSchema: z.object({
    marketingSummary: z.string().describe('Marketing-focused summary of the PDF content'),
    keyPoints: z.array(z.string()).describe('Key points extracted for ad copy creation'),
    targetAudience: z.string().optional().describe('Identified target audience from content'),
    valueProposition: z.string().optional().describe('Main value proposition identified'),
    fileSize: z.number().describe('Size of the downloaded file in bytes'),
    pagesCount: z.number().describe('Number of pages in the PDF'),
    characterCount: z.number().describe('Number of characters extracted from the PDF'),
  }),
  execute: async ({ context, mastra }) => {
    const { pdfUrl, focusAreas = [] } = context;

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

      // Step 3: Create marketing-focused summary
      console.log('🎯 Creating marketing-focused summary...');
      const contentSummarizerAgent = mastra?.getAgent('contentSummarizerAgent');
      if (!contentSummarizerAgent) {
        throw new Error('Content summarizer agent not found');
      }

      const focusAreasText = focusAreas.length > 0 ? `Focus particularly on: ${focusAreas.join(', ')}` : '';
      const summaryResult = await contentSummarizerAgent.generate([
        {
          role: 'user',
          content: `Please create a marketing-focused summary of this content for ad copy creation. ${focusAreasText}

Extract:
1. Main marketing summary (2-3 paragraphs)
2. Key selling points (bullet points)
3. Target audience insights
4. Primary value proposition

Content to analyze:
${extractionResult.extractedText}

Format your response as JSON with the following structure:
{
  "marketingSummary": "string",
  "keyPoints": ["point1", "point2", ...],
  "targetAudience": "string",
  "valueProposition": "string"
}`,
        },
      ]);

      let parsedSummary;
      try {
        parsedSummary = JSON.parse(summaryResult.text || '{}');
      } catch {
        // Fallback if JSON parsing fails
        parsedSummary = {
          marketingSummary: summaryResult.text || 'Summary could not be generated',
          keyPoints: [],
          targetAudience: undefined,
          valueProposition: undefined,
        };
      }

      console.log(`✅ Generated marketing summary: ${parsedSummary.marketingSummary?.length || 0} characters`);

      return {
        marketingSummary: parsedSummary.marketingSummary || 'Summary could not be generated',
        keyPoints: parsedSummary.keyPoints || [],
        targetAudience: parsedSummary.targetAudience,
        valueProposition: parsedSummary.valueProposition,
        fileSize: pdfBuffer.length,
        pagesCount: extractionResult.pagesCount,
        characterCount: extractionResult.extractedText.length,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ PDF content extraction failed:', errorMessage);
      throw new Error(`Failed to extract content from PDF: ${errorMessage}`);
    }
  },
});
