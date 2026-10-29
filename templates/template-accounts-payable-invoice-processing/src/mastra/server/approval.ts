import { registerApiRoute, type SimpleAuth } from '@mastra/core/server';
import { z } from 'zod';
import { signHumanApproval } from '../approvals/decision.ts';
import { ApprovalRequestSchema, invoiceWorkflow } from '../workflows/invoice.ts';
import type { InvoiceUser } from './auth.ts';

const ApprovalCommandSchema = z
  .object({
    approved: z.boolean(),
    invoiceDigest: z.string().regex(/^[a-f0-9]{64}$/),
    comment: z.string().trim().max(1000).optional(),
  })
  .strict();

export async function handleInvoiceApproval(
  request: Request,
  runId: string,
  workflow: typeof invoiceWorkflow,
  auth: SimpleAuth<InvoiceUser> | undefined,
): Promise<Response> {
  if (!auth) return Response.json({ error: 'Human approval authentication is not configured' }, { status: 503 });
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  // Only an explicit bearer credential may authorize a financial decision; ignore cookies and other headers.
  const authenticationRequest = new Request(request.url, { headers: { authorization } });
  const user = await auth.authenticateToken(authorization.slice(7), authenticationRequest);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'approver') return Response.json({ error: 'Human approver access required' }, { status: 403 });
  const command = ApprovalCommandSchema.safeParse(await request.json().catch(() => null));
  if (!command.success || !z.string().trim().min(1).max(200).safeParse(runId).success)
    return Response.json({ error: 'Invalid approval command' }, { status: 400 });
  const state = await workflow.getWorkflowRunById(runId);
  if (!state) return Response.json({ error: 'Invoice run not found' }, { status: 404 });
  const approvalState = state.steps?.['approve-invoice'];
  const pending = ApprovalRequestSchema.safeParse(
    Array.isArray(approvalState) ? undefined : approvalState?.suspendPayload,
  );
  if (state.status !== 'suspended' || !pending.success || pending.data.invoiceDigest !== command.data.invoiceDigest)
    return Response.json({ error: 'Run is not awaiting this invoice approval' }, { status: 409 });
  const run = await workflow.createRun({ runId });
  const result = await run.resume({
    step: 'approve-invoice',
    resumeData: signHumanApproval({ ...command.data, runId, reviewerId: user.id }),
  });
  return Response.json({ runId, status: result.status, result: result.status === 'success' ? result.result : null });
}

export function createInvoiceApprovalRoute(
  auth: SimpleAuth<InvoiceUser> | undefined,
  workflow: typeof invoiceWorkflow = invoiceWorkflow,
) {
  return registerApiRoute('/invoice-approvals/:runId', {
    method: 'POST',
    handler: context => handleInvoiceApproval(context.req.raw, context.req.param('runId'), workflow, auth),
  });
}
