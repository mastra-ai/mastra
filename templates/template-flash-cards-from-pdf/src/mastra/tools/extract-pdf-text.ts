import { createTool } from '@mastra/core/tools';
import { PDFParse } from 'pdf-parse';
import { z } from 'zod';

export const extractPdfText = createTool({
  id: 'extract-pdf-text',
  description: 'Extract text content from a base64-encoded PDF file',
  inputSchema: z.object({
    pdfBase64: z.string().describe('Base64-encoded PDF data (with or without data URI prefix)'),
  }),
  outputSchema: z.object({
    text: z.string().describe('Extracted text content from the PDF'),
    pageCount: z.number().describe('Number of pages in the PDF'),
    title: z.string().describe('PDF title from metadata, if available'),
  }),
  execute: async ({ pdfBase64 }) => {
    // Strip data URI prefix if present
    const base64Data = pdfBase64.replace(/^data:application\/pdf;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const info = await parser.getInfo();
    const totalPages = info.total;

    const pages: string[] = [];
    for (let i = 1; i <= totalPages; i++) {
      const result = await parser.getText({ partial: [i] });
      if (result.text.trim()) {
        pages.push(result.text.trim());
      }
    }

    await parser.destroy();

    return {
      text: pages.join('\n\n'),
      pageCount: totalPages,
      title: info.info?.Title ? String(info.info.Title) : '',
    };
  },
});
