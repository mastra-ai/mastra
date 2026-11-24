import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';
import { z } from 'zod';

import { EMPTY_MODEL_PACK_SET, FACTORY_MODEL_PACK_SETTING } from '../model-packs.js';
import type { ModelDefaultRecord, ModelDefaultsStorage } from '../storage/domains/model-defaults/base.js';
import type {
  ConfigRoutesDeps,
  ModelCatalog,
  PersonalModelDefaultsResponse,
  SessionModelContextResolver,
} from './config.js';
import { modelPackSetSchema } from './contracts.js';
import { tenantOrgId } from './provider-credentials.js';
import type { RouteAuth } from './route.js';

export interface ModelDefaultsContext {
  storage: ModelDefaultsStorage;
  orgId: string;
  userId: string;
}

export const sessionAddressSchema = z
  .object({
    resourceId: z.string().trim().min(1),
    threadId: z.string().trim().min(1),
    sessionId: z.string().trim().min(1).optional(),
  })
  .transform(data => ({ ...data, sessionId: data.sessionId ?? data.resourceId }));

export type SessionAddress = z.output<typeof sessionAddressSchema>;

export async function resolveModelDefaultsContext({
  c,
  auth,
  modelDefaults,
}: {
  c: Context;
  auth: RouteAuth;
  modelDefaults?: ModelDefaultsStorage;
}): Promise<ModelDefaultsContext | { response: Response }> {
  await auth.ensureUser(c);
  const tenant = auth.tenant(c);
  if (!tenant && auth.enabled()) return { response: c.json({ error: 'unauthorized' }, 401) };
  if (modelDefaults) {
    try {
      await modelDefaults.ensureReady();
      return tenant
        ? { storage: modelDefaults, orgId: tenantOrgId(tenant), userId: tenant.userId }
        : { storage: modelDefaults, orgId: 'local', userId: 'local' };
    } catch {
      return { response: modelDefaultsUnavailable(c) };
    }
  }
  return { response: modelDefaultsUnavailable(c) };
}

function modelDefaultsUnavailable(c: Context): Response {
  return c.json(
    {
      error: 'model_defaults_unavailable',
      message: 'Default model storage is unavailable — the app database is not configured or failed to start.',
    },
    503,
  );
}

export async function readSessionModelPackId(
  controller: ModelCatalog,
  { sessionId, threadId }: SessionAddress,
): Promise<string | null> {
  const session = await controller.getSession?.(sessionId);
  const thread = await session?.thread?.getById?.({ threadId });
  const packId = thread?.metadata?.[FACTORY_MODEL_PACK_SETTING];
  return typeof packId === 'string' ? packId : null;
}

function personalModelDefaults(record: ModelDefaultRecord | null): PersonalModelDefaultsResponse {
  if (!record) return { modelId: null, thinkingLevel: null, ...EMPTY_MODEL_PACK_SET };
  return {
    modelId: record.modelId,
    thinkingLevel: record.thinkingLevel,
    modelPacks: record.modelPacks,
    defaultModelPackId: record.defaultModelPackId,
  };
}

async function readJsonBody(c: Context): Promise<{ body: unknown } | { response: Response }> {
  try {
    return { body: await c.req.json() };
  } catch {
    return { response: c.json({ error: 'Invalid JSON body' }, 400) };
  }
}

export function modelPackRoutes(
  options: ConfigRoutesDeps,
  resolveSessionModelContext: SessionModelContextResolver,
): ApiRoute[] {
  const { auth } = options;
  const defaultsContext = (c: Context) =>
    resolveModelDefaultsContext({ c, auth, modelDefaults: options.modelDefaults });

  return [
    registerApiRoute('/web/config/default-model', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        const context = await defaultsContext(c);
        if ('response' in context) return context.response;
        try {
          const record = await context.storage.get({ orgId: context.orgId, userId: context.userId });
          return c.json(personalModelDefaults(record));
        } catch (error) {
          return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
        }
      },
    }),

    registerApiRoute('/web/config/model-packs', {
      method: 'PUT',
      requiresAuth: false,
      handler: async c => {
        const context = await defaultsContext(c);
        if ('response' in context) return context.response;
        const json = await readJsonBody(c);
        if ('response' in json) return json.response;
        const parsed = modelPackSetSchema.safeParse(json.body);
        if (!parsed.success) {
          return c.json({ error: 'invalid_model_packs', message: parsed.error.issues[0]?.message }, 400);
        }
        try {
          const record = await context.storage.setModelPacks({
            orgId: context.orgId,
            userId: context.userId,
            ...parsed.data,
          });
          return c.json(personalModelDefaults(record));
        } catch (error) {
          return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
        }
      },
    }),

    registerApiRoute('/web/config/session-model-pack', {
      method: 'PUT',
      requiresAuth: false,
      handler: async c => {
        const json = await readJsonBody(c);
        if ('response' in json) return json.response;
        const address = sessionAddressSchema.safeParse(json.body);
        const choice = z.object({ modelPackId: z.string().min(1) }).safeParse(json.body);
        if (!address.success || !choice.success) return c.json({ error: 'invalid_session_model_pack' }, 400);
        const { modelPackId } = choice.data;
        const context = await resolveSessionModelContext(c, address.data);
        if (context && 'response' in context) return context.response;
        const pack = (context?.modelPackSet ?? EMPTY_MODEL_PACK_SET).modelPacks.find(
          candidate => candidate.id === modelPackId,
        );
        const head = pack?.models[0];
        if (!head) return c.json({ error: 'model_pack_not_found' }, 404);
        const session = await options.controller.getSession?.(address.data.sessionId);
        if (!session?.model.switch || !session.thread?.setSettingOn) {
          return c.json({ error: 'session_not_running' }, 409);
        }
        try {
          await session.thread.setSettingOn({
            threadId: address.data.threadId,
            key: FACTORY_MODEL_PACK_SETTING,
            value: modelPackId,
          });
          await session.model.switch(head.modelId, { thinkingLevel: head.thinkingLevel });
          return c.json({ ok: true, modelPackId, modelId: head.modelId, thinkingLevel: head.thinkingLevel });
        } catch (error) {
          return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
        }
      },
    }),
  ];
}
