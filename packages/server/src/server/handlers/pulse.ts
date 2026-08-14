import type { Mastra } from '@mastra/core';
import { coreFeatures } from '@mastra/core/features';
import type { MastraCompositeStore, PulseStorage } from '@mastra/core/storage';
import { z } from 'zod/v4';
import { HTTPException } from '../http-exception';
import type { InferParams, ServerContext, ServerRoute, ServerRouteHandler } from '../server-adapter/routes';
import { createRoute } from '../server-adapter/routes/route-builder';
import { handleError } from './error';

/**
 * Pulse (event-first observability, experimental) endpoints.
 *
 * Read model over the `pulse` storage domain: flows, per-flow tree, and
 * timeline are DERIVED by the storage adapter — nothing here is stored state.
 * Gated twice: `pulse:v0` core feature (version capability) and the presence
 * of a configured pulse store (501 otherwise, matching the observability
 * endpoints' convention) — with no pulse store, server behavior is unchanged.
 */

function getStorage(mastra: Mastra): MastraCompositeStore {
  const storage = mastra.getStorage();
  if (!storage) {
    throw new HTTPException(500, { message: 'Storage is not available' });
  }
  return storage;
}

/** Retrieves the pulse storage domain or throws 501 if unavailable. */
export async function getPulseStore(mastra: Mastra): Promise<PulseStorage> {
  const storage = getStorage(mastra);
  const pulse = await storage.getStore('pulse');
  if (!pulse) {
    throw new HTTPException(501, { message: 'Pulse storage domain is not available' });
  }
  return pulse;
}

const flowStatusSchema = z.enum(['running', 'completed', 'failed', 'aborted', 'stale']);

const flowSummarySchema = z.object({
  flowId: z.string(),
  threadId: z.string().optional(),
  startedAt: z.union([z.string(), z.date()]),
  durationMs: z.number().nullable(),
  status: flowStatusSchema,
  pulseCount: z.number(),
  costUsd: z.number().optional(),
  entityName: z.string().optional(),
});

const flowTreeNodeSchema = z.object({
  spanId: z.string(),
  parentSpanId: z.string().optional(),
  label: z.string(),
  startedAt: z.union([z.string(), z.date()]),
  endedAt: z.union([z.string(), z.date()]).optional(),
  durationMs: z.number().nullable(),
  hasError: z.boolean(),
});

const timelineEntrySchema = z.object({
  timestamp: z.union([z.string(), z.date()]),
  seq: z.number(),
  source: z.string(),
  type: z.string(),
  surface: z.string(),
  action: z.string(),
  runId: z.string().optional(),
});

const listFlowsQuerySchema = z.object({
  status: flowStatusSchema.optional(),
  threadId: z.string().optional(),
  entityName: z.string().optional(),
  page: z.coerce.number().int().min(0).default(0),
  perPage: z.coerce.number().int().min(1).max(200).default(40),
});

interface PulseRouteDef {
  method: ServerRoute['method'];
  path: `/${string}`;
  summary: string;
  description: string;
}

function createPulseRoute<
  TPathSchema extends z.ZodTypeAny | undefined,
  TQuerySchema extends z.ZodTypeAny | undefined,
  TResponseSchema extends z.ZodTypeAny,
>(
  def: PulseRouteDef,
  config: {
    pathParamSchema?: TPathSchema;
    queryParamSchema?: TQuerySchema;
    responseSchema: TResponseSchema;
    handler: (
      params: InferParams<TPathSchema, TQuerySchema, undefined> & ServerContext,
    ) => Promise<z.infer<TResponseSchema>>;
  },
) {
  const { handler, ...schemas } = config;
  return createRoute({
    ...def,
    ...schemas,
    responseType: 'json' as const,
    tags: ['Pulse'],
    requiresAuth: true,
    handler: (async (params: InferParams<TPathSchema, TQuerySchema, undefined> & ServerContext) => {
      try {
        if (!coreFeatures.has('pulse:v0')) {
          throw new HTTPException(501, {
            message: 'Pulse endpoints require a @mastra/core version with pulse:v0 support.',
          });
        }
        return await handler(params);
      } catch (error) {
        return handleError(error, `Error calling: '${def.summary.toLocaleLowerCase()}'`);
      }
    }) as ServerRouteHandler<
      InferParams<TPathSchema, TQuerySchema, undefined>,
      TResponseSchema extends z.ZodTypeAny ? z.infer<TResponseSchema> : unknown,
      'json'
    >,
  });
}

export const LIST_PULSE_FLOWS = createPulseRoute(
  {
    method: 'GET',
    path: '/pulse/flows',
    summary: 'List pulse flows',
    description: 'Returns derived flows (status, duration, cost) from the pulse storage domain, most recent first',
  },
  {
    queryParamSchema: listFlowsQuerySchema,
    responseSchema: z.object({ flows: z.array(flowSummarySchema), total: z.number() }),
    handler: async ({ mastra, status, threadId, entityName, page, perPage }) => {
      const store = await getPulseStore(mastra);
      return await store.listFlows({
        filter: { status, threadId, entityName },
        pagination: { page, perPage },
      });
    },
  },
);

export const GET_PULSE_FLOW = createPulseRoute(
  {
    method: 'GET',
    path: '/pulse/flows/:flowId',
    summary: 'Get pulse flow',
    description: 'Returns one derived flow with its span tree and referenced definitions',
  },
  {
    pathParamSchema: z.object({ flowId: z.string() }),
    responseSchema: z.object({
      flow: flowSummarySchema
        .extend({ tree: z.array(flowTreeNodeSchema), definitions: z.array(z.string()) })
        .nullable(),
    }),
    handler: async ({ mastra, flowId }) => {
      const store = await getPulseStore(mastra);
      return { flow: await store.getFlow(flowId) };
    },
  },
);

export const GET_PULSE_FLOW_TIMELINE = createPulseRoute(
  {
    method: 'GET',
    path: '/pulse/flows/:flowId/timeline',
    summary: 'Get pulse flow timeline',
    description: 'Returns the ordered pulse timeline of a flow, session/runtime lanes interleaved by thread',
  },
  {
    pathParamSchema: z.object({ flowId: z.string() }),
    responseSchema: z.object({ timeline: z.array(timelineEntrySchema) }),
    handler: async ({ mastra, flowId }) => {
      const store = await getPulseStore(mastra);
      return { timeline: await store.getFlowTimeline(flowId) };
    },
  },
);

export const PULSE_ROUTES = [LIST_PULSE_FLOWS, GET_PULSE_FLOW, GET_PULSE_FLOW_TIMELINE] as const;
