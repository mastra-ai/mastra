import 'dotenv/config';
import { Agent } from '@mastra/core/agent';

export const invoiceExtractionAgent = new Agent({
  id: 'invoice-extraction-agent',
  name: 'Invoice extraction agent',
  model: process.env.INVOICE_READER_MODEL ?? 'openai/gpt-5.6-sol',
  instructions:
    'Extract only values printed on the invoice. Do not invent vendor or PO IDs. Use null for unreadable values. Dates must be yyyy-mm-dd, currency must be ISO 4217, and confidence values are estimates only.',
});
