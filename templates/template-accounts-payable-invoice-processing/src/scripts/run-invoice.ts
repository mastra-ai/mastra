import { mastra } from '../mastra/index.ts';
import { localDocument } from './support.ts';

const path = process.argv[2];
if (!path) throw new Error('Usage: npm run invoice:run -- path/to/invoice.pdf');
const workflow = mastra.getWorkflow('invoiceReaderWorkflow'),
  run = await workflow.createRun();
const result = await run.start({ inputData: await localDocument(path) });
console.log(JSON.stringify({ runId: run.runId, ...result }, null, 2));
