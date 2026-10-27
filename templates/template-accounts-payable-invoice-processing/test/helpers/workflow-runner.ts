import { Mastra } from '@mastra/core';
import { writeFile } from 'node:fs/promises';
import { createInvoiceApprovalRoute } from '../../src/mastra/server/approval.ts';
import { createInvoiceAuth, invoiceWorkflowAccess } from '../../src/mastra/server/auth.ts';
import { LibSQLStore } from '@mastra/libsql';
import { activeInvoiceRuntime } from '../../src/mastra/accounting/providers.ts';
import { createInvoiceWorkflow, invoiceWorkflow, signInvoiceSubmission } from '../../src/mastra/workflows/invoice.ts';
import { invoiceInput } from './invoice.ts';
import { accountsPayableAgent } from '../../src/mastra/agents/accounts-payable.ts';
import { createObservabilityContext } from '@mastra/core/observability';
import { RequestContext } from '@mastra/core/request-context';
import { noopObserve } from '@mastra/core/tools';
import { createNodeServer } from '@mastra/deployer/server';
import { InProcessStrategy } from '@mastra/core/worker';

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
  const auth = createInvoiceAuth();
  const mastra = new Mastra({
    workflows: { workflow },
    agents: { accountsPayableAgent },
    storage,
    server: {
      auth,
      host: '127.0.0.1',
      port: 0,
      handleShutdownSignals: false,
      middleware: [invoiceWorkflowAccess],
      apiRoutes: [createInvoiceApprovalRoute(auth, workflow)],
    },
  });
  const run = await workflow.createRun(operation.runId ? { runId: operation.runId } : {});
  const unsignedInput = invoiceInput(operation.invoice);
  if (operation.stepAttack) {
    const state = await workflow.getWorkflowRunById(operation.sourceRunId);
    const assessmentStep = state?.steps?.['assess-invoice'];
    const normalizedStep = state?.steps?.['normalize-invoice'];
    if (!assessmentStep || Array.isArray(assessmentStep)) throw new Error('Missing assessment');
    const assessment = assessmentStep.output;
    const input = {
      ...assessment,
      invoice: { ...assessment.invoice, document: { ...assessment.invoice.document, requiresHumanReview: false } },
      disposition: 'auto_post',
      executionStatus: 'ready_to_post',
      approval: {
        status: 'not_required',
        reviewerId: null,
        decidedAt: new Date().toISOString(),
        invoiceDigest: 'a'.repeat(64),
        comment: null,
      },
      posting: null,
      postingError: null,
    };
    const steps = operation.replay
      ? ['assess-invoice', 'approve-invoice']
      : ['assess-invoice', 'approve-invoice', 'post-invoice'];
    const parameters = (stepId: string) => ({
      workflowId: 'workflow',
      runId: operation.targetRunId ?? 'nonexistent-run',
      stepId,
      executionPath: [steps.indexOf(stepId) + 1],
      stepResults: {},
      state: {},
      requestContext: {},
      input: operation.replay
        ? stepId === 'assess-invoice'
          ? Array.isArray(normalizedStep)
            ? undefined
            : normalizedStep?.output
          : assessment
        : stepId === 'assess-invoice'
          ? input.invoice
          : input,
      validateInputs: false,
    });
    if (operation.stepAttack === 'worker') {
      const strategy = new InProcessStrategy({ mastra });
      const results = [];
      for (const step of steps) results.push(await strategy.executeStep(parameters(step)));
      process.stdout.write('\nAP_RESULT:' + JSON.stringify({ results }) + '\n');
      await storage.close();
      process.exit(0);
    }
    const server = await createNodeServer(mastra);
    if (!server.listening) await new Promise<void>(resolve => server.once('listening', resolve));
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('No HTTP listener');
      const token =
        operation.credential === 'none'
          ? undefined
          : operation.credential === 'approver'
            ? process.env.AP_APPROVAL_TOKEN
            : process.env.AP_API_TOKEN;
      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/workflows/workflow/runs/${parameters('post-invoice').runId}/steps/execute`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...(token && { authorization: `Bearer ${token}` }) },
          body: JSON.stringify(parameters('post-invoice')),
        },
      );
      process.stdout.write(
        '\nAP_RESULT:' + JSON.stringify({ httpStatus: response.status, response: await response.json() }) + '\n',
      );
    } finally {
      await new Promise<void>(resolve => server.close(() => resolve()));
      await storage.close();
    }
    process.exit(0);
  }
  const approveThroughHttp = async () => {
    const state = await workflow.getWorkflowRunById(operation.runId);
    const approvalState = state?.steps?.['approve-invoice'];
    const digest = Array.isArray(approvalState) ? undefined : approvalState?.suspendPayload?.invoiceDigest;
    const server = await createNodeServer(mastra);
    if (!server.listening) await new Promise<void>(resolve => server.once('listening', resolve));
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
