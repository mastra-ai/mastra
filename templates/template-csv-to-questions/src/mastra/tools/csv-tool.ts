import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

// CSV parsing tool that fetches and parses CSV from URL
export const csvTool = createTool({
  id: 'fetch-and-parse-csv',
  description: 'Fetch CSV data from a URL and parse it into structured format with analysis',
  inputSchema: z.object({
    csvUrl: z.string().describe('The URL to the CSV file to fetch and parse'),
  }),
  outputSchema: z.object({
    csvData: z.string().describe('The parsed CSV data as formatted text'),
    rowCount: z.number().describe('Number of rows in the CSV'),
    columnCount: z.number().describe('Number of columns in the CSV'),
  }),
  execute: async ({ context }) => {
    return await fetchAndParseCSV(context.csvUrl);
  },
});

// Function to fetch and parse CSV from URL
export async function fetchAndParseCSV(csvUrl: string): Promise<{
  csvData: string;
  rowCount: number;
  columnCount: number;
}> {
  if (!csvUrl || !csvUrl.trim()) {
    throw new Error('Invalid CSV URL: empty or null');
  }

  console.log('🔍 Fetching CSV from URL:', csvUrl);

  try {
    // Fetch CSV content
    const response = await fetch(csvUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch CSV: ${response.status} ${response.statusText}`);
    }

    const csvText = await response.text();

    if (!csvText || csvText.trim().length === 0) {
      throw new Error('CSV file is empty');
    }

    console.log(`📊 Processing CSV with ${csvText.length} characters`);

    // Parse CSV content
    const lines = csvText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const rowCount = lines.length;

    if (rowCount === 0) {
      throw new Error('CSV has no valid rows');
    }

    // Detect column count from first row
    const firstRow = lines[0];
    const columnCount = parseCSVRow(firstRow).length;

    // Format CSV data for question generation
    let formattedData = '';

    // Add header information
    if (rowCount > 0) {
      const headers = parseCSVRow(lines[0]);
      formattedData += `CSV Data Analysis:\n`;
      formattedData += `- Total Rows: ${rowCount}\n`;
      formattedData += `- Total Columns: ${columnCount}\n`;
      formattedData += `- Column Headers: ${headers.join(', ')}\n\n`;
    }

    // Add sample data (first 10 rows for context)
    const sampleRows = Math.min(10, rowCount);
    formattedData += `Sample Data (first ${sampleRows} rows):\n`;

    for (let i = 0; i < sampleRows; i++) {
      const row = parseCSVRow(lines[i]);
      if (i === 0) {
        formattedData += `Headers: ${row.join(' | ')}\n`;
      } else {
        formattedData += `Row ${i}: ${row.join(' | ')}\n`;
      }
    }

    // Add summary statistics if there are more rows
    if (rowCount > 10) {
      formattedData += `\n... and ${rowCount - 10} more rows\n`;
    }

    // Add data type analysis
    if (rowCount > 1) {
      formattedData += `\nData Analysis:\n`;
      const headers = parseCSVRow(lines[0]);
      const sampleRow = parseCSVRow(lines[1]);

      headers.forEach((header, index) => {
        const sampleValue = sampleRow[index] || '';
        const dataType = inferDataType(sampleValue);
        formattedData += `- ${header}: ${dataType}\n`;
      });
    }

    console.log(`✅ Parsed CSV with ${rowCount} rows and ${columnCount} columns`);

    return {
      csvData: formattedData,
      rowCount,
      columnCount,
    };

  } catch (error) {
    throw new Error(`CSV processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Simple CSV row parser (handles basic CSV format)
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
