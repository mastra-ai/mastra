import { createTool } from '@mastra/core/tools';
import chalk from 'chalk';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { z } from 'zod';

// @ts-ignore
import pdfParse from 'pdf-parse/lib/pdf-parse.js';

export const readPDF = createTool({
  id: 'readPDF',
  description: 'Read PDF file and extract information',
  inputSchema: z.object({
    pdfPath: z.string(),
  }),
  outputSchema: z.object({
    content: z.string(),
  }),
  execute: async ({ context: { pdfPath } }) => {
    try {
      // Check if file exists
      if (!existsSync(pdfPath)) {
        throw new Error('PDF file not found');
      }

      // Check if file is a PDF
      if (path.extname(pdfPath).toLowerCase() !== '.pdf') {
        throw new Error('File is not a PDF');
      }

      // Read the PDF file
      const dataBuffer = readFileSync(pdfPath);

      // Parse PDF content
      const data = await pdfParse(dataBuffer);

      console.log(chalk.blue('\n'));
      console.log(chalk.blue('PDF Information:'));
      console.log(chalk.blue('-----------------'));
      console.log(chalk.blue(`Number of pages: ${data.numpages}`));

      return { content: data.text };
    } catch (e) {
      return { content: 'Error scanning PDF' };
    }
  },
});
