import { Mastra } from '@mastra/core';
import { writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { handleInvoiceApproval } from '../../src/mastra/server/approval.ts';
import { createInvoiceAuth } from '../../src/mastra/server/auth.ts';
import { LibSQLStore } from '@mastra/libsql';
import { activeInvoiceRuntime } from '../../src/mastra/accounting/providers.ts';
import { createInvoiceWorkflow, invoiceWorkflow, signInvoiceSubmission } from '../../src/mastra/workflows/invoice.ts';
import { invoiceInput } from './invoice.ts';
import { accountsPayableAgent } from '../../src/mastra/agents/accounts-payable.ts';
import { createObservabilityContext } from '@mastra/core/observability';
import { RequestContext } from '@mastra/core/request-context';
import { noopObserve } from '@mastra/core/tools';

try {
  const operation = JSON.parse(process.argv[2]!);
  const runtime = operation.historyFailure
    ? {
        ...activeInvoiceRuntime,
        history: {
          findPotentialDuplicates: activeInvoiceRuntime.history.findPotentialDuplicates.bind(
            activeInvoiceRuntime.history,
          ),
          seed: activeInvoiceRuntime.history.seed.bind(activeInvoiceRuntime.history),
          // Exercise a real filesystem persistence failure after the MCP returns a created Bill.
          // The token store is a file, so writing a child of it fails with ENOTDIR.
          save: async (invoice: unknown) =>
            writeFile(`${process.env.QBO_MCP_TOKEN_STORE_PATH}/history.json`, JSON.stringify(invoice)),
        },
      }
    : activeInvoiceRuntime;
  const workflow = operation.tool || operation.agentApproval ? invoiceWorkflow : createInvoiceWorkflow(runtime);
  const storage = new LibSQLStore({ id: 'ap-workflow-test', url: process.env.MASTRA_DB_URL! });
  new Mastra({ workflows: { workflow }, agents: { accountsPayableAgent }, storage });
  const run = await workflow.createRun(operation.runId ? { runId: operation.runId } : {});
  const unsignedInput = invoiceInput(operation.invoice);
  const approveThroughHttp = async () => {
    const state = await workflow.getWorkflowRunById(operation.runId);
    const approvalState = state?.steps?.['approve-invoice'];
    const digest = Array.isArray(approvalState) ? undefined : approvalState?.suspendPayload?.invoiceDigest;
    const auth = createInvoiceAuth();
    const server = createServer(async (incoming, outgoing) => {
      try {
        const chunks: Buffer[] = [];
        for await (const chunk of incoming) chunks.push(Buffer.from(chunk));
        const request = new Request('http://127.0.0.1/invoice-approvals/' + operation.runId, {
          method: 'POST',
          headers: { authorization: incoming.headers.authorization ?? '', 'content-type': 'application/json' },
          body: Buffer.concat(chunks).toString(),
        });
        const response = await handleInvoiceApproval(request, operation.runId, workflow, auth);
        outgoing.writeHead(response.status, { 'content-type': 'application/json' });
        outgoing.end(await response.text());
      } catch (error) {
        outgoing.writeHead(500);
        outgoing.end(String(error));
      }
    });
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('No HTTP listener');
      const token =
        operation.credential === 'none'
          ? undefined
          : operation.credential === 'reader'
            ? process.env.AP_API_TOKEN
            : operation.credential === 'invalid'
              ? 'invalid-token'
              : process.env.AP_APPROVAL_TOKEN;
      const response = await fetch(`http://127.0.0.1:${address.port}/invoice-approvals/${operation.runId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(token && { authorization: `Bearer ${token}` }) },
        body: JSON.stringify({
          approved: operation.approved,
          invoiceDigest: operation.invoiceDigest ?? digest,
          comment: 'Reviewed in test',
        }),
      });
      return { ...((await response.json()) as Record<string, unknown>), httpStatus: response.status };
    } finally {
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  };

  const tools = operation.tool || operation.agentApproval ? await accountsPayableAgent.listTools() : undefined;
  const approvalTool = tools ? Reflect.get(tools, 'resumeApproval') : undefined;
  const result = operation.agentApproval
    ? approvalTool
      ? await approvalTool.execute(
          { runId: operation.runId, approved: true },
          {
            ...createObservabilityContext(),
            observe: noopObserve,
            requestContext: new RequestContext(),
          },
        )
      : { status: 'approval_unavailable', registeredTools: Object.keys(tools ?? {}) }
    : tools
      ? await tools.submitInvoice.execute!(
          { documentId: 'unverified-upload', source: 'image', draft: unsignedInput.extractedResult },
          {
            ...createObservabilityContext(),
            observe: noopObserve,
            requestContext: new RequestContext(),
          },
        )
      : operation.runId
        ? operation.unsafeResume
          ? await run.resume({
              step: 'approve-invoice',
              resumeData: operation.unsafeResume,
            })
          : await approveThroughHttp()
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
