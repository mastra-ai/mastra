import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { extractTextFromPDF } from '../lib/pdf-utils';

export const pdfContentExtractorTool = createTool({
  id: 'pdf-content-extractor',
  description:
    'Downloads a PDF from a URL, extracts content, and creates an educational summary for flash card generation',
  inputSchema: z
    .object({
      pdfUrl: z.string().optional().describe('URL to the PDF file to download'),
      pdfData: z.string().optional().describe('Base64 encoded PDF data from file attachment'),
      filename: z.string().optional().describe('Filename of the attached PDF (if using pdfData)'),
      subjectArea: z
        .string()
        .optional()
        .describe('Subject area to focus on (e.g., "biology", "history", "mathematics")'),
      focusAreas: z
        .array(z.string())
        .optional()
        .describe('Specific areas to focus on (e.g., "definitions", "concepts", "formulas", "dates")'),
    })
    .refine(data => data.pdfUrl || data.pdfData, {
      message: 'Either pdfUrl or pdfData must be provided',
      path: ['pdfUrl', 'pdfData'],
    }),
  outputSchema: z.object({
    educationalSummary: z.string().describe('Educational summary of the PDF content for flash card creation'),
    keyTopics: z.array(z.string()).describe('Key topics and concepts extracted for flash card generation'),
    definitions: z
      .array(
        z.object({
          term: z.string(),
          definition: z.string(),
        }),
      )
      .describe('Important terms and their definitions'),
    concepts: z
      .array(
        z.object({
          concept: z.string(),
          explanation: z.string(),
        }),
      )
      .describe('Key concepts and their explanations'),
    facts: z.array(z.string()).describe('Important facts and information'),
    subjectArea: z.string().optional().describe('Identified subject area from content'),
    fileSize: z.number().describe('Size of the downloaded file in bytes'),
    pagesCount: z.number().describe('Number of pages in the PDF'),
    characterCount: z.number().describe('Number of characters extracted from the PDF'),
  }),
  execute: async ({ context, mastra }) => {
    const { pdfUrl, pdfData, filename, subjectArea, focusAreas = [] } = context;

    let pdfBuffer: Buffer;
    const source = pdfData ? filename || 'attached file' : pdfUrl;

    console.log('📥 Processing PDF for educational content extraction:', source);

    try {
      // Step 1: Get the PDF buffer (either from URL or base64 data)
      if (pdfData) {
        // Handle base64 encoded PDF data from file attachment
        // Remove the data:application/pdf;base64, prefix if it exists
        const base64Data = pdfData.startsWith('data:application/pdf;base64,')
          ? pdfData.substring('data:application/pdf;base64,'.length)
          : pdfData;

        pdfBuffer = Buffer.from(base64Data, 'base64');
        console.log(`✅ Processed attached PDF: ${pdfBuffer.length} bytes`);
      } else if (pdfUrl) {
        // Handle PDF URL
        const response = await fetch(pdfUrl);

        if (!response.ok) {
          throw new Error(`Failed to download PDF: ${response.status} ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        pdfBuffer = Buffer.from(arrayBuffer);
        console.log(`✅ Downloaded PDF: ${pdfBuffer.length} bytes`);
      } else {
        throw new Error('Neither pdfUrl nor pdfData provided');
      }

      // Step 2: Extract text from PDF
      console.log('📄 Extracting text from PDF...');
      const extractionResult = await extractTextFromPDF(pdfBuffer);

      if (!extractionResult.extractedText || extractionResult.extractedText.trim() === '') {
        throw new Error('No text could be extracted from the PDF');
      }

      console.log(
        `✅ Extracted ${extractionResult.extractedText.length} characters from ${extractionResult.pagesCount} pages`,
      );

      // Step 3: Process content for educational analysis
      console.log('📄 Processing PDF content for educational analysis...');
      const pdfProcessorAgent = mastra?.getAgent('pdfProcessorAgent');
      if (!pdfProcessorAgent) {
        throw new Error('PDF processor agent not found');
      }

      const subjectAreaText = subjectArea ? `Subject area: ${subjectArea}` : '';
      const focusAreasText = focusAreas.length > 0 ? `Focus particularly on: ${focusAreas.join(', ')}` : '';

      const summaryResult = await pdfProcessorAgent.generate([
        {
          role: 'user',
          content: `Please create an educational summary of this PDF content for flash card generation. ${subjectAreaText} ${focusAreasText}

This summary will be used to generate educational flash cards, so please preserve all important concepts, definitions, facts, and relationships while making the content more manageable.

Content to summarize:
${extractionResult.extractedText}`,
        },
      ]);

      const summarizedContent = summaryResult.text || extractionResult.extractedText;

      // Step 4: Create educational analysis from summarized content
      console.log('🎓 Creating educational analysis for flash card generation...');
      const contentAnalyzerAgent = mastra?.getAgent('contentAnalyzerAgent');
      if (!contentAnalyzerAgent) {
        throw new Error('Content analyzer agent not found');
      }

      const analysisResult = await contentAnalyzerAgent.generate([
        {
          role: 'user',
          content: `Please analyze this educational content and prepare it for flash card generation. ${subjectAreaText} ${focusAreasText}

Extract and organize:
1. Educational summary (2-3 paragraphs overview)
2. Key topics and concepts suitable for flash cards
3. Important definitions (term-definition pairs)
4. Key concepts with explanations
5. Important facts and information
6. Subject area identification

Content to analyze:
${summarizedContent}

Format your response as JSON with the following structure:
{
  "educationalSummary": "string",
  "keyTopics": ["topic1", "topic2", ...],
  "definitions": [{"term": "string", "definition": "string"}, ...],
  "concepts": [{"concept": "string", "explanation": "string"}, ...],
  "facts": ["fact1", "fact2", ...],
  "subjectArea": "string"
}`,
        },
      ]);

      let parsedAnalysis;
      try {
        parsedAnalysis = JSON.parse(analysisResult.text || '{}');
      } catch {
        // Fallback if JSON parsing fails
        parsedAnalysis = {
          educationalSummary: analysisResult.text || 'Educational summary could not be generated',
          keyTopics: [],
          definitions: [],
          concepts: [],
          facts: [],
          subjectArea: subjectArea || 'Unknown',
        };
      }

      console.log(`✅ Generated educational analysis: ${parsedAnalysis.educationalSummary?.length || 0} characters`);

      return {
        educationalSummary: parsedAnalysis.educationalSummary || 'Educational summary could not be generated',
        keyTopics: parsedAnalysis.keyTopics || [],
        definitions: parsedAnalysis.definitions || [],
        concepts: parsedAnalysis.concepts || [],
        facts: parsedAnalysis.facts || [],
        subjectArea: parsedAnalysis.subjectArea || subjectArea,
        fileSize: pdfBuffer.length,
        pagesCount: extractionResult.pagesCount,
        characterCount: extractionResult.extractedText.length,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ PDF educational content extraction failed:', errorMessage);
      throw new Error(`Failed to extract educational content from PDF: ${errorMessage}`);
    }
  },
});
