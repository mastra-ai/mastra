import { SimpleAuth, type Middleware } from '@mastra/core/server';
import { z } from 'zod';

export type InvoiceUser = { id: string; role: 'reader' | 'approver' };

// This application runs workflows in-process and never accepts remote worker step commands.
export const invoiceWorkflowAccess: Middleware = {
  path: '/api/workflows/:workflowId/runs/:runId/steps/execute',
  handler: async context => context.json({ error: 'Remote workflow step execution is disabled' }, 403),
};
const AuthConfigSchema = z
  .object({
    production: z.boolean(),
    apiToken: z.string().min(32).optional(),
    approvalToken: z.string().min(32).optional(),
    workflowSigningKey: z.string().min(32).optional(),
    reviewerId: z.string().trim().min(1).optional(),
  })
  .superRefine((config, context) => {
    if (
      config.production &&
      (!config.apiToken || !config.approvalToken || !config.reviewerId || !config.workflowSigningKey)
    )
      context.addIssue({
        code: 'custom',
        message: 'Production requires AP_API_TOKEN, AP_APPROVAL_TOKEN, AP_APPROVER_ID and AP_WORKFLOW_SIGNING_KEY',
      });
    if (config.approvalToken && !config.reviewerId)
      context.addIssue({ code: 'custom', message: 'AP_APPROVER_ID is required with AP_APPROVAL_TOKEN' });
    if (config.apiToken && config.apiToken === config.approvalToken)
      context.addIssue({ code: 'custom', message: 'Reader and human approver tokens must be different' });
    if (config.workflowSigningKey && [config.apiToken, config.approvalToken].includes(config.workflowSigningKey))
      context.addIssue({ code: 'custom', message: 'The workflow signing key must be different from bearer tokens' });
  });

export function createInvoiceAuth(env: NodeJS.ProcessEnv = process.env): SimpleAuth<InvoiceUser> | undefined {
  const config = AuthConfigSchema.parse({
    production: env.NODE_ENV === 'production',
    apiToken: env.AP_API_TOKEN?.trim() || undefined,
    approvalToken: env.AP_APPROVAL_TOKEN?.trim() || undefined,
    workflowSigningKey: env.AP_WORKFLOW_SIGNING_KEY?.trim() || undefined,
    reviewerId: env.AP_APPROVER_ID?.trim() || undefined,
  });
  const tokens: Record<string, InvoiceUser> = Object.create(null);
  if (config.apiToken) tokens[config.apiToken] = { id: 'invoice-reader', role: 'reader' };
  if (config.approvalToken) tokens[config.approvalToken] = { id: config.reviewerId!, role: 'approver' };
  return Object.keys(tokens).length ? new SimpleAuth<InvoiceUser>({ tokens }) : undefined;
}
