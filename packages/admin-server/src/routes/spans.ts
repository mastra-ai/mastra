import type { Span, Trace } from '@mastra/admin';
import type { AdminServerContext, AdminServerRoute } from '../types';
import { publishSpansBodySchema, publishSpansResponseSchema } from '../schemas/spans';
import type { CloudSpanRecord, PublishSpansBody, PublishSpansResponse } from '../schemas/spans';

/**
 * Parse the access token to extract deployment ID.
 *
 * Token formats supported:
 * - `{deploymentId}` - Simple deployment ID
 * - `mst_{deploymentId}` - Prefixed deployment ID
 * - `mst_live_{deploymentId}` - Live environment token
 *
 * Returns the deployment ID or null if invalid.
 */
function parseAccessToken(token: string): string | null {
  if (!token) return null;

  // Remove "Bearer " prefix if present
  const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;

  // Handle prefixed formats
  if (cleanToken.startsWith('mst_live_')) {
    return cleanToken.slice(9) || null;
  }
  if (cleanToken.startsWith('mst_')) {
    return cleanToken.slice(4) || null;
  }

  // Assume it's a raw deployment ID (UUID format)
  return cleanToken || null;
}

/**
 * Map CloudExporter span type to Span kind.
 */
function mapSpanTypeToKind(spanType: string): Span['kind'] {
  const typeToKind: Record<string, Span['kind']> = {
    'llm.call': 'client',
    'tool.call': 'internal',
    'agent.run': 'server',
    'workflow.run': 'server',
    'workflow.step': 'internal',
    'http.request': 'client',
    'http.server': 'server',
    'db.query': 'client',
    producer: 'producer',
    consumer: 'consumer',
  };

  return typeToKind[spanType] ?? 'internal';
}

/**
 * Determine span status from error info.
 */
function determineStatus(error: unknown): Span['status'] {
  if (error === null || error === undefined) {
    return 'ok';
  }
  if (typeof error === 'object' && Object.keys(error).length === 0) {
    return 'ok';
  }
  return 'error';
}

/**
 * Transform CloudExporter span record to ObservabilityWriter Span format.
 */
function transformSpan(cloudSpan: CloudSpanRecord, projectId: string, deploymentId: string): Span {
  const startTime = new Date(cloudSpan.startedAt);
  const endTime = cloudSpan.endedAt ? new Date(cloudSpan.endedAt) : null;
  const durationMs = endTime ? endTime.getTime() - startTime.getTime() : null;

  // Merge attributes and metadata, plus add input/output/error
  const attributes: Record<string, unknown> = {
    ...(cloudSpan.attributes ?? {}),
    ...(cloudSpan.metadata ?? {}),
  };

  // Add span type as attribute
  if (cloudSpan.spanType) {
    attributes['mastra.span_type'] = cloudSpan.spanType;
  }

  // Add input/output if present
  if (cloudSpan.input !== null && cloudSpan.input !== undefined) {
    attributes['mastra.input'] = cloudSpan.input;
  }
  if (cloudSpan.output !== null && cloudSpan.output !== undefined) {
    attributes['mastra.output'] = cloudSpan.output;
  }
  if (cloudSpan.error !== null && cloudSpan.error !== undefined) {
    attributes['mastra.error'] = cloudSpan.error;
  }
  if (cloudSpan.isEvent) {
    attributes['mastra.is_event'] = true;
  }

  return {
    spanId: cloudSpan.spanId,
    traceId: cloudSpan.traceId,
    parentSpanId: cloudSpan.parentSpanId,
    projectId,
    deploymentId,
    name: cloudSpan.name,
    kind: mapSpanTypeToKind(cloudSpan.spanType),
    status: determineStatus(cloudSpan.error),
    startTime,
    endTime,
    durationMs,
    attributes,
    events: [], // CloudExporter doesn't send span events separately
  };
}

/**
 * Generate a file path for observability events.
 * Pattern: {basePath}/{eventType}/{projectId}/{timestamp}_{uuid}.jsonl
 */
function generateFilePath(basePath: string, eventType: string, projectId: string): string {
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const uuid = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  return `${basePath}/${eventType}/${projectId}/${timestamp}_${uuid}.jsonl`;
}

/**
 * Derive traces from spans.
 * Creates a trace record for each unique traceId, using the root span (no parent) as the source.
 */
function deriveTracesFromSpans(spans: Span[], projectId: string, deploymentId: string): Trace[] {
  // Group spans by traceId
  const spansByTraceId = new Map<string, Span[]>();
  for (const span of spans) {
    const existing = spansByTraceId.get(span.traceId) ?? [];
    existing.push(span);
    spansByTraceId.set(span.traceId, existing);
  }

  const traces: Trace[] = [];

  for (const [traceId, traceSpans] of spansByTraceId) {
    // Find root span (no parent) or use the first span
    const rootSpan = traceSpans.find(s => !s.parentSpanId) ?? traceSpans[0];
    if (!rootSpan) continue;

    // Determine overall trace status (error if any span has error)
    const hasError = traceSpans.some(s => s.status === 'error');
    const status = hasError ? 'error' : rootSpan.status;

    // Calculate trace timing from all spans
    const startTimes = traceSpans.map(s => s.startTime.getTime());
    const endTimes = traceSpans
      .filter(s => s.endTime)
      .map(s => s.endTime!.getTime());

    const startTime = new Date(Math.min(...startTimes));
    const endTime = endTimes.length > 0 ? new Date(Math.max(...endTimes)) : null;
    const durationMs = endTime ? endTime.getTime() - startTime.getTime() : null;

    traces.push({
      traceId,
      projectId,
      deploymentId,
      name: rootSpan.name,
      status,
      startTime,
      endTime,
      durationMs,
      metadata: rootSpan.attributes as Record<string, unknown>,
    });
  }

  return traces;
}

/**
 * Serialize spans to JSONL format.
 */
function serializeSpansToJsonl(spans: Span[]): string {
  return (
    spans
      .map(span => JSON.stringify({ type: 'span', data: span }))
      .join('\n') + '\n'
  );
}

/**
 * Serialize traces to JSONL format.
 */
function serializeTracesToJsonl(traces: Trace[]): string {
  return (
    traces
      .map(trace => JSON.stringify({ type: 'trace', data: trace }))
      .join('\n') + '\n'
  );
}

/**
 * POST /spans/publish - Receive spans from CloudExporter.
 *
 * This endpoint accepts spans in the CloudExporter format and writes them
 * to file storage for later ingestion into ClickHouse.
 *
 * Authentication: Bearer token containing the deployment ID.
 * The deployment must exist and the project will be looked up from it.
 */
export const PUBLISH_SPANS_ROUTE: AdminServerRoute = {
  method: 'POST',
  path: '/spans/publish',
  responseType: 'json',
  bodySchema: publishSpansBodySchema,
  responseSchema: publishSpansResponseSchema,
  requiresAuth: false, // Uses custom token auth
  summary: 'Publish spans',
  description: 'Receive spans from CloudExporter and write to file storage',
  tags: ['Observability'],
  maxBodySize: 50 * 1024 * 1024, // 50MB to handle large batches
  handler: async (params): Promise<PublishSpansResponse> => {
    const { admin, logger, accessToken } = params as AdminServerContext;
    const { spans } = params as unknown as PublishSpansBody;

    logger.info('[spans/publish] Received request', {
      hasAccessToken: !!accessToken,
      spanCount: spans?.length ?? 0,
    });

    if (!accessToken) {
      logger.warn('[spans/publish] Missing access token');
      return {
        success: false,
        received: 0,
        message: 'Missing Authorization header',
      };
    }

    const deploymentId = parseAccessToken(accessToken);
    logger.info('[spans/publish] Parsed token', {
      accessToken: accessToken.substring(0, 20) + '...',
      deploymentId,
    });

    if (!deploymentId) {
      logger.warn('[spans/publish] Invalid token format');
      return {
        success: false,
        received: 0,
        message: 'Invalid access token format',
      };
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(deploymentId)) {
      logger.warn('[spans/publish] Invalid deployment ID format', { deploymentId });
      return {
        success: false,
        received: 0,
        message: 'Invalid deployment ID format (must be UUID)',
      };
    }

    // Look up deployment to get projectId
    const storage = admin.getStorage();
    let deployment;
    try {
      deployment = await storage.getDeployment(deploymentId);
    } catch (error) {
      logger.error('[spans/publish] Error looking up deployment', {
        deploymentId,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        received: 0,
        message: 'Error looking up deployment',
      };
    }

    if (!deployment) {
      logger.warn('[spans/publish] Deployment not found', { deploymentId });
      return {
        success: false,
        received: 0,
        message: 'Deployment not found',
      };
    }

    logger.info('[spans/publish] Found deployment', {
      deploymentId,
      projectId: deployment.projectId,
    });

    const project = await storage.getProject(deployment.projectId);
    if (!project) {
      logger.warn('[spans/publish] Project not found', {
        projectId: deployment.projectId,
      });
      return {
        success: false,
        received: 0,
        message: 'Project not found',
      };
    }

    const projectId = project.id;

    // Get file storage
    const fileStorage = admin.getObservabilityFileStorage();
    if (!fileStorage) {
      logger.warn('[spans/publish] Observability storage not configured');
      return {
        success: false,
        received: 0,
        message: 'Observability storage not configured',
      };
    }

    if (spans.length === 0) {
      logger.info('[spans/publish] No spans to write');
      return {
        success: true,
        received: 0,
      };
    }

    // Transform spans
    const transformedSpans = spans.map(span => transformSpan(span, projectId, deploymentId));

    // Derive traces from spans (creates trace records from root spans)
    const derivedTraces = deriveTracesFromSpans(transformedSpans, projectId, deploymentId);

    // Write to file storage
    const basePath = 'observability';
    const spansFilePath = generateFilePath(basePath, 'span', projectId);
    const spansContent = serializeSpansToJsonl(transformedSpans);

    logger.info('[spans/publish] Writing spans to storage', {
      spanCount: spans.length,
      traceCount: derivedTraces.length,
      projectId,
      deploymentId,
      spansFilePath,
    });

    try {
      // Write spans
      await fileStorage.write(spansFilePath, Buffer.from(spansContent, 'utf8'));

      // Write derived traces if any
      if (derivedTraces.length > 0) {
        const tracesFilePath = generateFilePath(basePath, 'trace', projectId);
        const tracesContent = serializeTracesToJsonl(derivedTraces);
        await fileStorage.write(tracesFilePath, Buffer.from(tracesContent, 'utf8'));

        logger.info('[spans/publish] Successfully wrote spans and traces', {
          spanCount: spans.length,
          traceCount: derivedTraces.length,
          projectId,
          deploymentId,
        });
      } else {
        logger.info('[spans/publish] Successfully wrote spans', {
          spanCount: spans.length,
          projectId,
          deploymentId,
        });
      }

      return {
        success: true,
        received: spans.length,
      };
    } catch (error) {
      logger.error('[spans/publish] Failed to write spans', {
        error: error instanceof Error ? error.message : String(error),
        projectId,
        deploymentId,
      });

      return {
        success: false,
        received: 0,
        message: 'Failed to write spans to storage',
      };
    }
  },
};

/**
 * All spans routes.
 */
export const SPANS_ROUTES: AdminServerRoute[] = [PUBLISH_SPANS_ROUTE];
