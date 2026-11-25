import type { ThinkingLevelSetting } from '@mastra/code-sdk/thinking';
import { RequestContext } from '@mastra/core/request-context';
import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';
import { z } from 'zod';

import {
  defaultModelPack,
  EMPTY_MODEL_PACK_SET,
  FACTORY_MODEL_SELECTION_SETTING,
  parseStoredModelSelection,
  resolvedModelSelection,
  resolveModelSelection,
} from '../model-packs.js';
import type {
  ModelPackSet,
  ModelSelectionRequest,
  ResolvedModelSelection,
  StoredModelSelection,
} from '../model-packs.js';
import { resolveRoutedModelDefaults } from '../session/routed-model-defaults.js';
import type { ModelDefaultRecord, ModelDefaultsStorage } from '../storage/domains/model-defaults/base.js';
import type {
  ConfigRoutesDeps,
  ModelCatalog,
  PersonalModelDefaultsResponse,
  SessionModelContext,
  SessionModelContextResolver,
} from './config.js';
import { modelIdSchema, modelPackSetSchema, THINKING_LEVELS } from './contracts.js';
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

const modelSelectionRequestSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('default') }),
  z.object({ kind: z.literal('pack'), packId: z.string().min(1) }),
  z.object({ kind: z.literal('model'), modelId: modelIdSchema, thinkingLevel: z.enum(THINKING_LEVELS).optional() }),
]);

interface SessionModelTarget {
  stored: StoredModelSelection;
  modelId: string;
  thinkingLevel?: ThinkingLevelSetting;
  modelSelection: ResolvedModelSelection;
}

function sessionModelTarget(set: ModelPackSet, selection: ModelSelectionRequest): SessionModelTarget | undefined {
  if (selection.kind === 'model') {
    return {
      stored: { kind: 'model' },
      modelId: selection.modelId,
      ...(selection.thinkingLevel ? { thinkingLevel: selection.thinkingLevel } : {}),
      modelSelection: { kind: 'model' },
    };
  }
  const pack =
    selection.kind === 'default'
      ? defaultModelPack(set)
      : set.modelPacks.find(candidate => candidate.id === selection.packId);
  const head = pack?.models[0];
  if (!pack || !head) return undefined;
  return {
    stored: selection,
    modelId: head.modelId,
    thinkingLevel: head.thinkingLevel,
    modelSelection: { kind: 'pack', packId: pack.id },
  };
}

export async function resolveSessionModelPackSet(
  options: ConfigRoutesDeps,
  context: SessionModelContext | undefined,
  address: SessionAddress,
): Promise<ModelPackSet> {
  if (context) return context.modelPackSet;
  const { factoryProjects, sourceControlSessions, workItems, modelDefaults } = options;
  if (!factoryProjects || !sourceControlSessions || !workItems || !modelDefaults) return EMPTY_MODEL_PACK_SET;
  const requestContext = new RequestContext();
  requestContext.set('controller', address);
  const routed = await resolveRoutedModelDefaults(requestContext, {
    projects: factoryProjects,
    sourceControl: sourceControlSessions,
    workItems,
    modelDefaults,
  });
  return routed.modelPackSet;
}

export async function readSessionModelSelection(
  controller: ModelCatalog,
  { sessionId, threadId }: SessionAddress,
  set: ModelPackSet,
): Promise<ResolvedModelSelection> {
  const session = await controller.getSession?.(sessionId);
  const thread = await session?.thread?.getById?.({ threadId });
  const stored = parseStoredModelSelection(thread?.metadata?.[FACTORY_MODEL_SELECTION_SETTING]);
  return resolvedModelSelection(resolveModelSelection(set, stored, session?.model.get() || undefined));
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

    registerApiRoute('/web/config/session-model', {
      method: 'PUT',
      requiresAuth: false,
      handler: async c => {
        const json = await readJsonBody(c);
        if ('response' in json) return json.response;
        const address = sessionAddressSchema.safeParse(json.body);
        const request = z.object({ selection: modelSelectionRequestSchema }).safeParse(json.body);
        if (!address.success || !request.success) return c.json({ error: 'invalid_session_model' }, 400);
        const context = await resolveSessionModelContext(c, address.data);
        if (context && 'response' in context) return context.response;
        const set = await resolveSessionModelPackSet(options, context, address.data);
        const target = sessionModelTarget(set, request.data.selection);
        if (!target) return c.json({ error: 'model_pack_not_found' }, 404);
        const session = await options.controller.getSession?.(address.data.sessionId);
        const thread = session?.thread;
        if (!session?.model.switch || !thread?.setSettingOn) return c.json({ error: 'session_not_running' }, 409);
        if (thread.getId() !== address.data.threadId) return c.json({ error: 'session_thread_mismatch' }, 409);
        const { threadId } = address.data;
        try {
          const previous = (await thread.getById?.({ threadId }))?.metadata?.[FACTORY_MODEL_SELECTION_SETTING];
          await thread.setSettingOn({ threadId, key: FACTORY_MODEL_SELECTION_SETTING, value: target.stored });
          try {
            await (target.thinkingLevel
              ? session.model.switch(target.modelId, { thinkingLevel: target.thinkingLevel })
              : session.model.switch(target.modelId));
          } catch (error) {
            await thread.setSettingOn({ threadId, key: FACTORY_MODEL_SELECTION_SETTING, value: previous });
            throw error;
          }
          return c.json({ modelSelection: target.modelSelection });
        } catch (error) {
          return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
        }
      },
    }),
  ];
}
