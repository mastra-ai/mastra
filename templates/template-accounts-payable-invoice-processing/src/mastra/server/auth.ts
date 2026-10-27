import { SimpleAuth } from '@mastra/core/server';
import { z } from 'zod';

export type InvoiceUser = { id: string; role: 'reader' | 'approver' };
const AuthConfigSchema = z
  .object({
    production: z.boolean(),
    apiToken: z.string().min(32).optional(),
    approvalToken: z.string().min(32).optional(),
    reviewerId: z.string().trim().min(1).optional(),
  })
  .superRefine((config, context) => {
    if (config.production && (!config.apiToken || !config.approvalToken || !config.reviewerId))
      context.addIssue({
        code: 'custom',
        message: 'Production requires AP_API_TOKEN, AP_APPROVAL_TOKEN and AP_APPROVER_ID',
      });
    if (config.approvalToken && !config.reviewerId)
      context.addIssue({ code: 'custom', message: 'AP_APPROVER_ID is required with AP_APPROVAL_TOKEN' });
    if (config.apiToken && config.apiToken === config.approvalToken)
      context.addIssue({ code: 'custom', message: 'Reader and human approver tokens must be different' });
  });

export function createInvoiceAuth(env: NodeJS.ProcessEnv = process.env): SimpleAuth<InvoiceUser> | undefined {
  const config = AuthConfigSchema.parse({
    production: env.NODE_ENV === 'production',
    apiToken: env.AP_API_TOKEN?.trim() || undefined,
    approvalToken: env.AP_APPROVAL_TOKEN?.trim() || undefined,
    reviewerId: env.AP_APPROVER_ID?.trim() || undefined,
  });
  const tokens: Record<string, InvoiceUser> = Object.create(null);
  if (config.apiToken) tokens[config.apiToken] = { id: 'invoice-reader', role: 'reader' };
  if (config.approvalToken) tokens[config.approvalToken] = { id: config.reviewerId!, role: 'approver' };
  return Object.keys(tokens).length ? new SimpleAuth<InvoiceUser>({ tokens }) : undefined;
}
