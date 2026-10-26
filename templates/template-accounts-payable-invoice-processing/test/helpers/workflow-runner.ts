import { Mastra } from '@mastra/core';
import { LibSQLStore } from '@mastra/libsql';
import { activeInvoiceRuntime } from '../../src/mastra/accounting/providers.ts';
import { createInvoiceWorkflow, signInvoiceSubmission } from '../../src/mastra/workflows/invoice.ts';
import { invoiceInput } from './invoice.ts';

try {
  const operation = JSON.parse(process.argv[2]!);
  const workflow = createInvoiceWorkflow(activeInvoiceRuntime);
  const storage = new LibSQLStore({ id: 'ap-workflow-test', url: process.env.MASTRA_DB_URL! });
  new Mastra({ workflows: { workflow }, storage });
  const run = await workflow.createRun(operation.runId ? { runId: operation.runId } : {});
  const unsignedInput = invoiceInput(operation.invoice);
  const result = operation.runId
    ? await run.resume({
        step: 'approve-invoice',
        resumeData: { approved: operation.approved, comment: 'Reviewed in test' },
      })
    : await run.start({
        inputData: {
          ...unsignedInput,
          submissionSignature: operation.invalidSignature ? '0'.repeat(64) : signInvoiceSubmission(unsignedInput),
        },
      });
  process.stdout.write('\nAP_RESULT:' + JSON.stringify({ runId: run.runId, ...result }) + '\n');
  await storage.close();
  process.exit(0);
} catch (error) {
  console.error(error);
  process.exit(1);
}
