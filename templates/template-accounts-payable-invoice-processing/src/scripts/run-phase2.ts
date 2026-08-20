import { mastra } from '../mastra/index.ts';
import { invoiceFixtures } from '../mastra/fixtures/invoices.ts';

const workflow = mastra.getWorkflow('apInvoiceWorkflow'),
  run = await workflow.createRun();
const result = await run.start({ inputData: invoiceFixtures[0]!.document });
if (result.status !== 'success') throw new Error(`AP workflow ended ${result.status}`);
console.log(
  JSON.stringify(
    {
      runId: run.runId,
      disposition: result.result.disposition,
      executionStatus: result.result.executionStatus,
      posting: result.result.posting,
      matchMode: result.result.matchMode,
      decisions: result.result.decisions,
    },
    null,
    2,
  ),
);
