import { z } from 'zod/v4';
import { HTTPException } from '../http-exception';
import { createRoute } from '../server-adapter/routes/route-builder';

const knowledgeImporterWebhookPathParams = z.object({
  instanceKey: z.string().min(1),
  importerId: z.string().min(1),
});

const knowledgeImporterWebhookBody = z.object({
  payload: z.unknown().optional(),
});

const knowledgeImportRunSchema = z.object({
  id: z.string(),
  importerId: z.string(),
  binding: z.string(),
  importKind: z.enum(['static', 'agentic']),
  triggerKind: z.enum(['cron', 'webhook', 'programmatic']),
  status: z.enum(['queued', 'running', 'succeeded', 'failed', 'skipped', 'interrupted']),
  error: z.string().optional(),
  transcriptThreadId: z.string().optional(),
  traceId: z.string().optional(),
  queuedAt: z.date(),
  startedAt: z.date().optional(),
  completedAt: z.date().optional(),
});

export const RUN_KNOWLEDGE_IMPORTER_WEBHOOK_ROUTE = createRoute({
  method: 'POST',
  path: '/knowledge/:instanceKey/importers/:importerId/webhook',
  responseType: 'json',
  requiresAuth: true,
  pathParamSchema: knowledgeImporterWebhookPathParams,
  bodySchema: knowledgeImporterWebhookBody,
  responseSchema: knowledgeImportRunSchema,
  handler: async ({ mastra, instanceKey, importerId, payload, request, requestContext }) => {
    let knowledge;
    try {
      knowledge = mastra.getKnowledge(instanceKey);
    } catch {
      throw new HTTPException(404, { message: 'Knowledge importer not found' });
    }
    const importer = knowledge.getImporter(importerId);
    if (!importer?.triggers.webhook) {
      throw new HTTPException(404, { message: 'Knowledge importer not found' });
    }
    try {
      const binding = importer.triggers.webhook.resolveBinding
        ? await importer.triggers.webhook.resolveBinding({ payload, request, requestContext })
        : importer.triggers.webhook.bindings[0]!;
      return await knowledge.runImporter(importerId, binding, payload, { triggerKind: 'webhook' });
    } catch (error) {
      if (error instanceof Error && error.message.includes('does not allow this webhook binding')) {
        throw new HTTPException(404, { message: 'Knowledge importer not found' });
      }
      throw error;
    }
  },
});
