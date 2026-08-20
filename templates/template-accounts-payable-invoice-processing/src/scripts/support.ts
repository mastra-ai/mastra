import { basename, extname, resolve } from 'node:path';
import { RequestContext } from '@mastra/core/request-context';
import { mastra } from '../mastra/index.ts';
import { invoiceFixtures, type InvoiceFixture } from '../mastra/fixtures/invoices.ts';
import type { DocumentRef, ExtractedInvoice } from '../mastra/schemas/invoice.ts';

export { invoiceFixtures };
export async function runFixture(fixture: InvoiceFixture) {
  const workflow = mastra.getWorkflow('invoiceReaderWorkflow');
  const run = await workflow.createRun();
  let result = await run.start({ inputData: fixture.document });
  const suspended = result.status === 'suspended';
  if (suspended) {
    const requestContext = new RequestContext<{ reviewerId?: string }>([['reviewerId', 'fixture-reviewer']]);
    result = await run.resume({
      step: 'verify-invoice',
      resumeData: { extracted: fixture.groundTruth },
      requestContext,
    });
  }
  if (result.status !== 'success') throw new Error(`Fixture ${fixture.document.id} ended ${result.status}`);
  return {
    runId: run.runId,
    suspended,
    result: result.result as { extractedResult: ExtractedInvoice },
  };
}
export async function localDocument(path: string): Promise<DocumentRef> {
  const absolutePath = resolve(path),
    extension = extname(absolutePath).toLowerCase();
  const mimeType =
    extension === '.pdf'
      ? 'application/pdf'
      : extension === '.png'
        ? 'image/png'
        : extension === '.jpg' || extension === '.jpeg'
          ? 'image/jpeg'
          : 'application/octet-stream';
  return {
    id: basename(absolutePath),
    localPath: absolutePath,
    mimeType,
    source: mimeType === 'application/pdf' ? 'PDF' : 'image',
  };
}
