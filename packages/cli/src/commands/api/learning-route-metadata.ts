/**
 * Hand-authored route metadata for the Trace Intelligence (Agent Learning) read API.
 *
 * These routes are served by the Mastra platform learning endpoint
 * (`https://output.signals.mastra.ai/api/learning/*`), not by `@mastra/server`,
 * so they are not part of the generated server route metadata. The shapes here
 * mirror the platform's learning HTTP schemas; update them together.
 */

const TRACE_SIGNAL_NAMES = ['goal', 'sentiment', 'behavior', 'outcome'] as const;

const entityTypeSchema = {
  type: 'string',
  description: 'Entity type to query, e.g. "agent"',
} as const;

const signalNamesSchema = {
  type: 'string',
  description: `Ordered, comma-separated trace signal names (1-4 unique values of: ${TRACE_SIGNAL_NAMES.join(', ')}), e.g. "goal,outcome"`,
} as const;

const signalNameSchema = {
  type: 'string',
  enum: [...TRACE_SIGNAL_NAMES],
  description: 'One trace signal name',
} as const;

const snapshotIdSchema = {
  type: 'string',
  description:
    'Opaque snapshot ID from `learning snapshots`. Send it back unchanged with the same entity and signal selection.',
} as const;

const filterThemesSchema = {
  type: 'string',
  minLength: 1,
  pattern:
    '^(?!.*(?:^|,)(goal|sentiment|behavior|outcome):(noise|[0-9]+)(?:,[^,]+)*,\\1:)(goal|sentiment|behavior|outcome):(noise|[0-9]+)(,(goal|sentiment|behavior|outcome):(noise|[0-9]+)){0,3}$',
  description:
    'Optional AND filters for examples: 1-4 comma-separated entries with unique signals, using signalName:themeId or signalName:noise.',
} as const;

const entityIdParamSchema = {
  type: 'object',
  properties: { entityId: { type: 'string', description: 'Entity ID from `learning entities`' } },
  required: ['entityId'],
} as const;

const themeParamSchema = {
  type: 'object',
  properties: {
    entityId: { type: 'string', description: 'Entity ID from `learning entities`' },
    themeId: { type: 'string', description: 'Numeric durable theme ID' },
  },
  required: ['entityId', 'themeId'],
} as const;

export const LEARNING_ROUTE_METADATA = {
  'GET /learning/entities': {
    method: 'GET',
    path: '/learning/entities',
    pathParams: [],
    queryParams: ['entityType', 'limit'],
    bodyParams: [],
    hasQuery: true,
    hasBody: false,
    responseShape: { kind: 'object-property', listProperty: 'entities' },
  },
  'GET /learning/entities/:entityId/theme-snapshots': {
    method: 'GET',
    path: '/learning/entities/:entityId/theme-snapshots',
    pathParams: ['entityId'],
    queryParams: ['cursor', 'entityType', 'from', 'limit', 'signalNames', 'to'],
    bodyParams: [],
    hasQuery: true,
    hasBody: false,
    responseShape: { kind: 'object-property', listProperty: 'snapshots' },
  },
  'GET /learning/entities/:entityId/theme-flow': {
    method: 'GET',
    path: '/learning/entities/:entityId/theme-flow',
    pathParams: ['entityId'],
    queryParams: ['entityType', 'signalNames', 'snapshotId', 'themeLimitPerStage'],
    bodyParams: [],
    hasQuery: true,
    hasBody: false,
    responseShape: { kind: 'single' },
  },
  'GET /learning/entities/:entityId/theme-paths': {
    method: 'GET',
    path: '/learning/entities/:entityId/theme-paths',
    pathParams: ['entityId'],
    queryParams: ['entityType', 'limit', 'offset', 'signalNames', 'snapshotId'],
    bodyParams: [],
    hasQuery: true,
    hasBody: false,
    responseShape: { kind: 'single' },
  },
  'GET /learning/entities/:entityId/themes': {
    method: 'GET',
    path: '/learning/entities/:entityId/themes',
    pathParams: ['entityId'],
    queryParams: ['entityType', 'signalName', 'snapshotId'],
    bodyParams: [],
    hasQuery: true,
    hasBody: false,
    responseShape: { kind: 'object-property', listProperty: 'themes' },
  },
  'GET /learning/entities/:entityId/themes/:themeId': {
    method: 'GET',
    path: '/learning/entities/:entityId/themes/:themeId',
    pathParams: ['entityId', 'themeId'],
    queryParams: ['entityType', 'signalName', 'snapshotId'],
    bodyParams: [],
    hasQuery: true,
    hasBody: false,
    responseShape: { kind: 'single' },
  },
  'GET /learning/entities/:entityId/themes/:themeId/examples': {
    method: 'GET',
    path: '/learning/entities/:entityId/themes/:themeId/examples',
    pathParams: ['entityId', 'themeId'],
    queryParams: ['entityType', 'filterThemes', 'limit', 'offset', 'signalName', 'snapshotId'],
    bodyParams: [],
    hasQuery: true,
    hasBody: false,
    responseShape: { kind: 'object-property', listProperty: 'examples' },
  },
  'GET /learning/entities/:entityId/themes/:themeId/history': {
    method: 'GET',
    path: '/learning/entities/:entityId/themes/:themeId/history',
    pathParams: ['entityId', 'themeId'],
    queryParams: ['cursor', 'entityType', 'limit', 'signalName'],
    bodyParams: [],
    hasQuery: true,
    hasBody: false,
    responseShape: { kind: 'single' },
  },
  'GET /learning/entities/:entityId/noise': {
    method: 'GET',
    path: '/learning/entities/:entityId/noise',
    pathParams: ['entityId'],
    queryParams: ['entityType', 'signalName', 'snapshotId'],
    bodyParams: [],
    hasQuery: true,
    hasBody: false,
    responseShape: { kind: 'single' },
  },
  'GET /learning/entities/:entityId/noise/examples': {
    method: 'GET',
    path: '/learning/entities/:entityId/noise/examples',
    pathParams: ['entityId'],
    queryParams: ['entityType', 'filterThemes', 'limit', 'offset', 'signalName', 'snapshotId'],
    bodyParams: [],
    hasQuery: true,
    hasBody: false,
    responseShape: { kind: 'object-property', listProperty: 'examples' },
  },
} as const;

/**
 * Local request schemas for learning commands, keyed by `METHOD /path`.
 *
 * The learning endpoint does not expose `/api/system/api-schema`, so `--schema`
 * resolves these instead of fetching a manifest from the target server.
 */
export const LEARNING_ROUTE_SCHEMAS: Record<
  keyof typeof LEARNING_ROUTE_METADATA,
  { pathParamSchema?: unknown; queryParamSchema?: unknown }
> = {
  'GET /learning/entities': {
    queryParamSchema: {
      type: 'object',
      properties: {
        entityType: entityTypeSchema,
        limit: { type: 'integer', minimum: 1, maximum: 500 },
      },
      required: ['entityType'],
    },
  },
  'GET /learning/entities/:entityId/theme-snapshots': {
    pathParamSchema: entityIdParamSchema,
    queryParamSchema: {
      type: 'object',
      properties: {
        entityType: entityTypeSchema,
        signalNames: signalNamesSchema,
        limit: { type: 'integer', minimum: 1, maximum: 100 },
        cursor: { type: 'string', description: 'Opaque pagination cursor from a previous response' },
        from: { type: 'string', format: 'date-time', description: 'Inclusive lower bound on snapshot cutoff' },
        to: { type: 'string', format: 'date-time', description: 'Inclusive upper bound on snapshot cutoff' },
      },
      required: ['entityType', 'signalNames'],
    },
  },
  'GET /learning/entities/:entityId/theme-flow': {
    pathParamSchema: entityIdParamSchema,
    queryParamSchema: {
      type: 'object',
      properties: {
        entityType: entityTypeSchema,
        signalNames: signalNamesSchema,
        snapshotId: snapshotIdSchema,
        themeLimitPerStage: { type: 'integer', minimum: 1, maximum: 100 },
      },
      required: ['entityType', 'signalNames', 'snapshotId'],
    },
  },
  'GET /learning/entities/:entityId/theme-paths': {
    pathParamSchema: entityIdParamSchema,
    queryParamSchema: {
      type: 'object',
      properties: {
        entityType: entityTypeSchema,
        signalNames: signalNamesSchema,
        snapshotId: snapshotIdSchema,
        limit: { type: 'integer', minimum: 1, maximum: 500 },
        offset: { type: 'integer', minimum: 0, maximum: 100000 },
      },
      required: ['entityType', 'signalNames', 'snapshotId'],
    },
  },
  'GET /learning/entities/:entityId/themes': {
    pathParamSchema: entityIdParamSchema,
    queryParamSchema: {
      type: 'object',
      properties: {
        entityType: entityTypeSchema,
        signalName: signalNameSchema,
        snapshotId: snapshotIdSchema,
      },
      required: ['entityType', 'signalName', 'snapshotId'],
    },
  },
  'GET /learning/entities/:entityId/themes/:themeId': {
    pathParamSchema: themeParamSchema,
    queryParamSchema: {
      type: 'object',
      properties: {
        entityType: entityTypeSchema,
        signalName: signalNameSchema,
        snapshotId: snapshotIdSchema,
      },
      required: ['entityType', 'signalName', 'snapshotId'],
    },
  },
  'GET /learning/entities/:entityId/themes/:themeId/examples': {
    pathParamSchema: themeParamSchema,
    queryParamSchema: {
      type: 'object',
      properties: {
        entityType: entityTypeSchema,
        signalName: signalNameSchema,
        snapshotId: snapshotIdSchema,
        limit: { type: 'integer', minimum: 1, maximum: 100 },
        offset: { type: 'integer', minimum: 0, maximum: 100000 },
        filterThemes: filterThemesSchema,
      },
      required: ['entityType', 'signalName', 'snapshotId'],
    },
  },
  'GET /learning/entities/:entityId/themes/:themeId/history': {
    pathParamSchema: themeParamSchema,
    queryParamSchema: {
      type: 'object',
      properties: {
        entityType: entityTypeSchema,
        signalName: signalNameSchema,
        limit: { type: 'integer', minimum: 1, maximum: 500 },
        cursor: { type: 'string', description: 'Opaque pagination cursor from a previous response' },
      },
      required: ['entityType', 'signalName'],
    },
  },
  'GET /learning/entities/:entityId/noise': {
    pathParamSchema: entityIdParamSchema,
    queryParamSchema: {
      type: 'object',
      properties: {
        entityType: entityTypeSchema,
        signalName: signalNameSchema,
        snapshotId: snapshotIdSchema,
      },
      required: ['entityType', 'signalName', 'snapshotId'],
    },
  },
  'GET /learning/entities/:entityId/noise/examples': {
    pathParamSchema: entityIdParamSchema,
    queryParamSchema: {
      type: 'object',
      properties: {
        entityType: entityTypeSchema,
        signalName: signalNameSchema,
        snapshotId: snapshotIdSchema,
        limit: { type: 'integer', minimum: 1, maximum: 100 },
        offset: { type: 'integer', minimum: 0, maximum: 100000 },
        filterThemes: filterThemesSchema,
      },
      required: ['entityType', 'signalName', 'snapshotId'],
    },
  },
};
