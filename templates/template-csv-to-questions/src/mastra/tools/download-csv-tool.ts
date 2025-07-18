import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

// CSV parsing helper function
function parseCSVRow(row: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const char = row[i];

    if (char === '"' && !inQuotes) {
      inQuotes = true;
    } else if (char === '"' && inQuotes) {
      inQuotes = false;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

// Infer data type from sample value
function inferDataType(value: string): string {
  if (!value || value.trim() === '') {
    return 'empty/null';
  }

  // Check if it's a number
  if (!isNaN(Number(value)) && !isNaN(parseFloat(value))) {
    return Number.isInteger(Number(value)) ? 'integer' : 'decimal';
  }

  // Check if it's a date (basic check)
  const datePattern = /^\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}|\d{2}-\d{2}-\d{4}/;
  if (datePattern.test(value)) {
    return 'date';
  }

  // Check if it's a boolean
  const lowerValue = value.toLowerCase();
  if (lowerValue === 'true' || lowerValue === 'false' || lowerValue === 'yes' || lowerValue === 'no') {
    return 'boolean';
  }

  return 'text';
}

export const csvFetcherTool = createTool({
  id: 'download-csv-tool',
  description: 'Downloads a CSV from a URL, parses it, and returns a comprehensive summary',
  inputSchema: z.object({
    csvUrl: z.string().describe('URL to the CSV file to download'),
  }),
  outputSchema: z.object({
    summary: z.string().describe('AI-generated summary of the CSV data'),
    fileSize: z.number().describe('Size of the downloaded file in bytes'),
    rowCount: z.number().describe('Number of rows in the CSV'),
    columnCount: z.number().describe('Number of columns in the CSV'),
    characterCount: z.number().describe('Number of characters in the original CSV'),
  }),
  execute: async ({ context, mastra }) => {
    const { csvUrl } = context;

    console.log('📥 Downloading CSV from URL:', csvUrl);

    try {
      // Step 1: Download the CSV
      const response = await fetch(csvUrl);

      if (!response.ok) {
        throw new Error(`Failed to download CSV: ${response.status} ${response.statusText}`);
      }

      const csvText = await response.text();
      const csvBuffer = Buffer.from(csvText, 'utf-8');

      if (!csvText || csvText.trim().length === 0) {
        throw new Error('CSV file is empty');
      }

      console.log(`✅ Downloaded CSV: ${csvBuffer.length} bytes`);

      // Step 2: Parse and analyze CSV
      console.log('📊 Parsing and analyzing CSV...');
      const lines = csvText
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
      const rowCount = lines.length;
      const columnCount = rowCount > 0 ? parseCSVRow(lines[0]).length : 0;

      if (rowCount === 0) {
        throw new Error('CSV has no valid rows');
      }

      // Create structured data analysis
      let structuredData = `CSV Data Analysis:\n`;
      structuredData += `- Total Rows: ${rowCount}\n`;
      structuredData += `- Total Columns: ${columnCount}\n`;
      structuredData += `- File Size: ${csvBuffer.length} bytes\n\n`;

      // Add column analysis
      if (rowCount > 0) {
        const headers = parseCSVRow(lines[0]);
        structuredData += `Column Headers:\n`;
        headers.forEach((header, index) => {
          structuredData += `${index + 1}. ${header}\n`;
        });
        structuredData += '\n';
      }

      // Add data type analysis
      if (rowCount > 1) {
        const headers = parseCSVRow(lines[0]);
        const sampleRow = parseCSVRow(lines[1]);

        structuredData += `Data Type Analysis:\n`;
        headers.forEach((header, index) => {
          const sampleValue = sampleRow[index] || '';
          const dataType = inferDataType(sampleValue);
          structuredData += `- ${header}: ${dataType} (sample: "${sampleValue}")\n`;
        });
        structuredData += '\n';
      }

      // Add sample data
      const sampleRows = Math.min(5, rowCount);
      structuredData += `Sample Data (first ${sampleRows} rows):\n`;

      for (let i = 0; i < sampleRows; i++) {
        const row = parseCSVRow(lines[i]);
        if (i === 0) {
          structuredData += `Headers: ${row.join(' | ')}\n`;
        } else {
          structuredData += `Row ${i}: ${row.join(' | ')}\n`;
        }
      }

      if (rowCount > 5) {
        structuredData += `\n... and ${rowCount - 5} more rows\n`;
      }

      console.log(`✅ Parsed CSV: ${rowCount} rows, ${columnCount} columns`);

      // Step 3: Generate summary using the AI agent
      console.log('🧠 Generating AI summary...');
      const csvSummarizationAgent = mastra?.getAgent('csvSummarizationAgent');
      if (!csvSummarizationAgent) {
        throw new Error('CSV summarization agent not found');
      }

      const summaryResult = await csvSummarizationAgent.generate([
        {
          role: 'user',
          content: `Please provide a comprehensive summary of this CSV dataset:\n\n${structuredData}`,
        },
      ]);

      const summary = summaryResult.text || 'Summary could not be generated';

      console.log(`✅ Generated summary: ${summary.length} characters`);

      return {
        summary,
        fileSize: csvBuffer.length,
        rowCount,
        columnCount,
        characterCount: csvText.length,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ CSV processing failed:', errorMessage);
      throw new Error(`Failed to process CSV from URL: ${errorMessage}`);
    }
  },
});
