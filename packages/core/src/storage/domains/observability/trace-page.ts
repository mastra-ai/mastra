import { createHash } from 'node:crypto';
import { z } from 'zod/v4';
import { spanRecordSchema, computeTraceStatus, TraceStatus } from './tracing';
import type { SpanRecord } from './tracing';

// Bound serialized identities so every accepted ID batch fits in a continuation request.
export const tracePageIdSchema = z
  .string()
  .min(1)
  .max(128)
  .refine(value => Buffer.byteLength(JSON.stringify(value)) <= 384, 'Identifier exceeds the serialized byte limit');
const id = tracePageIdSchema;
const readTokenSchema = z
  .string()
  .min(1)
  .max(4096)
  .refine(value => Buffer.byteLength(JSON.stringify(value)) <= 4098, 'Read token exceeds the serialized byte limit');
const selectionSchema = z
  .object({
    mode: z.literal('context').optional(),
    readToken: readTokenSchema.optional(),
    anchorSpanId: id.optional(),
    depth: z.number().int().min(0).max(32).optional().describe('Browse depth from the anchor or roots; defaults to 2.'),
    spanIds: z.array(id).min(1).max(100).optional(),
    search: z.string().trim().min(1).max(256).optional(),
    ancestors: z.boolean().optional(),
    flattenResumes: z.boolean().optional(),
    includeFamilySummary: z.boolean().optional(),
    include: z.enum(['structure', 'full']).default('structure'),
    limit: z.number().int().min(1).max(200).default(100),
    maxBytes: z.number().int().min(65536).max(4194304).default(1048576),
  })
  .strict();

/** POST body for the getTracePage endpoint. Continuations cannot change selection. */
export const tracePageRequestSchema = z.union([
  selectionSchema.superRefine((value, ctx) => {
    if (
      value.mode === 'context' &&
      (value.readToken ||
        value.spanIds ||
        value.anchorSpanId ||
        value.search ||
        value.depth !== undefined ||
        value.ancestors !== undefined)
    ) {
      ctx.addIssue({ code: 'custom', message: 'Context mode starts a new trace read and cannot select spans' });
    }
    if (
      value.spanIds &&
      (value.anchorSpanId || value.search || value.depth !== undefined || value.ancestors !== undefined)
    ) {
      ctx.addIssue({ code: 'custom', message: 'spanIds cannot be combined with browse or search selection' });
    }
    if (value.search && (value.anchorSpanId || value.depth !== undefined)) {
      ctx.addIssue({ code: 'custom', message: 'Search covers the entire trace; anchorSpanId is browse-only' });
    }
    if (value.ancestors !== undefined && !value.search) {
      ctx.addIssue({ code: 'custom', message: 'ancestors requires search' });
    }
  }),
  z.object({ cursor: z.string().min(1).max(60000) }).strict(),
]);
export type TracePageRequest = z.input<typeof tracePageRequestSchema>;

// Trace context belongs to actual roots, not the anchor of an arbitrary subtree.
const tracePageRootContextSchema = spanRecordSchema
  .pick({
    experimentId: true,
    userId: true,
    organizationId: true,
    resourceId: true,
    runId: true,
    sessionId: true,
    threadId: true,
    requestId: true,
    environment: true,
    source: true,
    serviceName: true,
    tags: true,
  })
  .extend({ projectId: z.string().nullish() });

const traceContextSchema = z
  .object({
    readToken: readTokenSchema,
    lowerEndedAt: z.string().datetime(),
    upperEndedAt: z.string().datetime(),
    roots: z.array(tracePageRootContextSchema.extend({ spanId: id })).max(200),
  })
  .refine(value => value.lowerEndedAt <= value.upperEndedAt, 'Invalid trace time bounds');

const familySummarySchema = spanRecordSchema
  .pick({
    startedAt: true,
    endedAt: true,
    outcome: true,
    stopReason: true,
    stopReasonContext: true,
    outputPreview: true,
    errorPreview: true,
  })
  .extend({
    initialSpanId: z.string(),
    currentSpanId: z.string(),
    executionCount: z.number().int().positive(),
    originalAvailable: z.boolean(),
  });

const executionFamilyId = (span: Pick<SpanRecord, 'spanId' | 'spanType' | 'resumedFromSpanId'>) =>
  span.spanType === 'agent_run' ? span.resumedFromSpanId || span.spanId : undefined;

/** Execution diagnostics and previews; full payloads and metadata remain in details. */
export const tracePageNodeSchema = spanRecordSchema
  .pick({
    traceId: true,
    spanId: true,
    parentSpanId: true,
    name: true,
    spanType: true,
    isEvent: true,
    startedAt: true,
    endedAt: true,
    entityType: true,
    entityId: true,
    entityName: true,
    model: true,
    provider: true,
    outcome: true,
    stopReason: true,
    stopReasonContext: true,
    errorCount: true,
    externalParentSpanId: true,
    resumedFromSpanId: true,
    timeToFirstChunkMs: true,
    inputPreview: true,
    outputPreview: true,
    errorPreview: true,
    timeToFirstTokenMs: true,
  })
  .extend({
    executionFamilyId: z.string().optional(),
    displayParentSpanId: z.string().nullable().optional(),
    familySummary: familySummarySchema.optional(),
    status: z.nativeEnum(TraceStatus),
    childCount: z.number().int().nonnegative().nullable(),
    match: z.boolean(),
    parentState: z.enum(['root', 'available', 'unavailable', 'not-requested']),
    details: spanRecordSchema.omit({ scope: true, links: true }).optional(),
  });
export const tracePageResponseSchema = z.object({
  traceId: z.string(),
  nodes: z.array(tracePageNodeSchema),
  traceContext: traceContextSchema.optional(),
  missingSpanIds: z.array(z.string()),
  nextCursor: z.string().optional(),
  ancestorPaths: z.enum(['not-requested', 'continued', 'complete', 'unavailable']),
});
export type TracePageResponse = z.infer<typeof tracePageResponseSchema>;
export type TracePageNode = z.infer<typeof tracePageNodeSchema>;
export type TracePageStructure = Pick<
  SpanRecord,
  'traceId' | 'spanId' | 'parentSpanId' | 'startedAt' | 'spanType' | 'resumedFromSpanId'
>;
export type TracePageSummary = Pick<
  SpanRecord,
  | 'traceId'
  | 'spanId'
  | 'parentSpanId'
  | 'startedAt'
  | 'name'
  | 'spanType'
  | 'isEvent'
  | 'endedAt'
  | 'entityType'
  | 'entityId'
  | 'entityName'
  | 'model'
  | 'provider'
  | 'outcome'
  | 'stopReason'
  | 'stopReasonContext'
  | 'errorCount'
  | 'externalParentSpanId'
  | 'resumedFromSpanId'
  | 'timeToFirstChunkMs'
  | 'inputPreview'
  | 'outputPreview'
  | 'errorPreview'
  | 'timeToFirstTokenMs'
> &
  z.infer<typeof tracePageRootContextSchema> & { error?: unknown };

export class TracePageError extends Error {
  constructor(
    public readonly code:
      | 'INVALID_REQUEST'
      | 'INVALID_CURSOR'
      | 'TRACE_CHANGED'
      | 'UNSUPPORTED'
      | 'LIMIT_EXCEEDED'
      | 'INVALID_TOPOLOGY'
      | 'PAYLOAD_TOO_LARGE',
    message: string,
  ) {
    super(message);
    this.name = 'TracePageError';
  }
}

/**
 * @internal Experimental Platform integration; not a supported OSS storage-adapter contract.
 * All reads must independently enforce trusted scope. A cursor is never authorization.
 * Cursors are unsigned base64url JSON, not integrity-protected tokens. Their fingerprint
 * detects selection changes, not forgery; decoded requests must still be validated.
 */
export interface TracePageSource {
  scopeKey: string;
  /** Establish or reuse a bounded read before any structure, payload, or search queries. */
  context?(traceId: string, readToken?: string, includeRoots?: boolean): Promise<z.infer<typeof traceContextSchema>>;
  /** Return at most limit topology rows; the extra row detects overflow. */
  structure(traceId: string, limit: number): Promise<TracePageStructure[] | null>;
  /**
   * Read only the selected IDs, excluding payload fields for structure projection.
   * Include a non-null `error` indicator for failed spans so status is computed correctly.
   * Full projection returns span details including the actual error payload; scope and links are omitted.
   */
  spans(traceId: string, spanIds: string[], include: 'structure' | 'full'): Promise<TracePageSummary[]>;
  /** Complete matching identities within this trace; fail rather than truncate. */
  search?(traceId: string, text: string): Promise<string[]>;
}

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const cursorSchema = z
  .object({
    version: z.literal(2),
    selection: selectionSchema,
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    offset: z.number().int().min(1).max(50000),
  })
  .strict();

/**
 * @internal Experimental Platform reader; not a supported OSS storage-adapter contract.
 * Bounded wire pages over a capped topology read; this is not O(page size) database work.
 * Explicit IDs without flattening/family summaries skip topology: unknown IDs are reported
 * as missing without a separate trace-existence check. childCount is null and a non-root
 * parentState is 'not-requested'. A source context may independently verify trace existence.
 */
export async function readTracePage(
  source: TracePageSource,
  traceId: string,
  request: TracePageRequest,
): Promise<TracePageResponse | null> {
  if (!id.safeParse(traceId).success) throw new TracePageError('INVALID_REQUEST', 'Invalid trace identifier');
  const requestResult = tracePageRequestSchema.safeParse(request);
  if (!requestResult.success) {
    const code = request && typeof request === 'object' && 'cursor' in request ? 'INVALID_CURSOR' : 'INVALID_REQUEST';
    throw new TracePageError(
      code,
      code === 'INVALID_CURSOR' ? 'Invalid trace continuation' : 'Invalid trace page request',
    );
  }
  const parsed = requestResult.data;
  let continuation: z.infer<typeof cursorSchema> | undefined;
  if ('cursor' in parsed) {
    try {
      if (!/^[A-Za-z0-9_-]+$/.test(parsed.cursor)) throw new Error();
      continuation = cursorSchema.parse(JSON.parse(Buffer.from(parsed.cursor, 'base64url').toString('utf8')));
      tracePageRequestSchema.parse(continuation.selection);
    } catch {
      throw new TracePageError('INVALID_CURSOR', 'Invalid trace continuation');
    }
  }
  const initialSelection = continuation?.selection ?? ('cursor' in parsed ? undefined : parsed);
  if (!initialSelection) throw new TracePageError('INVALID_CURSOR', 'Invalid trace continuation');
  const incomingToken = initialSelection.readToken;
  if ((incomingToken || initialSelection.mode === 'context') && !source.context)
    throw new TracePageError('UNSUPPORTED', 'Trace read context is unavailable');
  const contextResult = source.context
    ? traceContextSchema.safeParse(
        await source.context(
          traceId,
          incomingToken,
          !incomingToken && !initialSelection.anchorSpanId && !initialSelection.spanIds && !initialSelection.search,
        ),
      )
    : undefined;
  if (contextResult && !contextResult.success)
    throw new Error('Invalid trace context returned by source', { cause: contextResult.error });
  const context = contextResult?.data;
  const selectionResult = selectionSchema.safeParse(
    context ? { ...initialSelection, readToken: context.readToken } : initialSelection,
  );
  if (!selectionResult.success)
    throw new Error('Invalid trace selection after source context', { cause: selectionResult.error });
  const selection = selectionResult.data;
  const initialContext = !incomingToken ? context : undefined;
  if (selection.mode === 'context') {
    const response: TracePageResponse = {
      traceId,
      nodes: [],
      missingSpanIds: [],
      ancestorPaths: 'not-requested',
      traceContext: initialContext,
    };
    if (Buffer.byteLength(JSON.stringify(response)) > selection.maxBytes)
      throw new TracePageError('LIMIT_EXCEEDED', 'Trace context exceeds maxBytes');
    return response;
  }
  if (selection.search && !source.search)
    throw new TracePageError('UNSUPPORTED', 'Indexed in-trace search is unavailable');
  const offset = continuation?.offset ?? 0;
  const families = new Map<string, { current: TracePageStructure; count: number; originalAvailable: boolean }>();
  const renderPage = async (
    ids: string[],
    fingerprint: string,
    topology?: {
      nodes: Map<string, TracePageStructure>;
      rawNodes: Map<string, TracePageStructure>;
      children: Map<string, TracePageStructure[]>;
      matches: Set<string>;
      missingSpanIds: string[];
      unavailableAncestors: boolean;
    },
  ): Promise<TracePageResponse> => {
    // The explicit-ID fast path fingerprints requested positions, independent of fetched membership.
    // Flattened/family selections also fingerprint the topology found for those IDs.
    if (continuation && continuation.fingerprint !== fingerprint)
      throw new TracePageError('TRACE_CHANGED', 'Selection or request scope changed; restart this selection');
    if (continuation && offset >= ids.length)
      throw new TracePageError('INVALID_CURSOR', 'Continuation is outside the selection');
    const pageIds = ids.slice(offset, offset + selection.limit);
    const records = pageIds.length ? await source.spans(traceId, pageIds, selection.include) : [];
    const recordsById = new Map<string, TracePageSummary>();
    for (const record of records) {
      if (
        record.traceId !== traceId ||
        !pageIds.includes(record.spanId) ||
        recordsById.has(record.spanId) ||
        !Number.isFinite(record.startedAt.getTime())
      )
        throw new TracePageError('INVALID_TOPOLOGY', 'Page read returned conflicting identities or timestamps');
      const node = topology?.rawNodes.get(record.spanId);
      if (
        node &&
        ((node.parentSpanId ?? null) !== (record.parentSpanId ?? null) ||
          node.startedAt.getTime() !== record.startedAt.getTime() ||
          node.spanType !== record.spanType ||
          (node.resumedFromSpanId ?? null) !== (record.resumedFromSpanId ?? null))
      )
        throw new TracePageError('TRACE_CHANGED', 'Selected structure changed during the read');
      recordsById.set(record.spanId, record);
    }
    const summaries = new Map<string, z.infer<typeof familySummarySchema>>();
    if (selection.includeFamilySummary && topology) {
      const familyIds = [...new Set(records.map(executionFamilyId).filter((value): value is string => !!value))];
      const latestIds = familyIds
        .map(id => families.get(id)?.current.spanId)
        .filter((id): id is string => !!id && !recordsById.has(id));
      const latestRecords = latestIds.length ? await source.spans(traceId, latestIds, 'structure') : [];
      const latestById = new Map(recordsById);
      for (const record of latestRecords) {
        const expected = topology.rawNodes.get(record.spanId);
        if (
          !latestIds.includes(record.spanId) ||
          latestById.has(record.spanId) ||
          record.traceId !== traceId ||
          !expected ||
          expected.startedAt.getTime() !== record.startedAt.getTime() ||
          expected.spanType !== record.spanType ||
          (expected.resumedFromSpanId ?? null) !== (record.resumedFromSpanId ?? null) ||
          (expected.parentSpanId ?? null) !== (record.parentSpanId ?? null)
        )
          throw new TracePageError('TRACE_CHANGED', 'Family execution changed during the read');
        latestById.set(record.spanId, record);
      }
      for (const initialSpanId of familyIds) {
        const family = families.get(initialSpanId);
        const current = family && latestById.get(family.current.spanId);
        if (!family || !current)
          throw new TracePageError('TRACE_CHANGED', 'Family execution disappeared during the read');
        summaries.set(
          initialSpanId,
          familySummarySchema.parse({
            ...current,
            initialSpanId,
            currentSpanId: current.spanId,
            executionCount: family.count,
            originalAvailable: family.originalAvailable,
          }),
        );
      }
    }
    const result: TracePageResponse = {
      traceId,
      nodes: [],
      ...(initialContext ? { traceContext: initialContext } : {}),
      missingSpanIds: [...(topology?.missingSpanIds ?? [])],
      ancestorPaths: 'not-requested',
    };
    let nodeBytes = 0;
    let missingIdBytes = result.missingSpanIds.reduce(
      (bytes, spanId) => bytes + Buffer.byteLength(JSON.stringify(spanId)),
      0,
    );
    // Fixed metadata and cursor selection are serialized once, including large read contexts.
    // Only the offset digit count, ancestor state and array contents change while fitting nodes.
    const fixedEnvelopeBytes = Buffer.byteLength(JSON.stringify({ ...result, nodes: [], missingSpanIds: [] }));
    const cursorPrefix = JSON.stringify({ version: 2, selection, fingerprint }).slice(0, -1) + ',"offset":';
    const cursorPropertyBytes = Buffer.byteLength(',"nextCursor":""');
    const fixedCursorBytes = Buffer.byteLength(cursorPrefix) + 1; // Closing brace.
    let processed = 0;
    const hasContinuation = () => offset + processed < ids.length;
    const cursorLength = () => Math.ceil(((fixedCursorBytes + String(offset + processed).length) * 4) / 3);
    const ancestorPaths = (): TracePageResponse['ancestorPaths'] =>
      selection.search && selection.ancestors !== false
        ? hasContinuation()
          ? 'continued'
          : topology?.unavailableAncestors
            ? 'unavailable'
            : 'complete'
        : 'not-requested';
    const responseBytes = () =>
      fixedEnvelopeBytes +
      ancestorPaths().length -
      'not-requested'.length +
      (hasContinuation() ? cursorPropertyBytes + cursorLength() : 0) +
      nodeBytes +
      Math.max(0, result.nodes.length - 1) +
      missingIdBytes +
      Math.max(0, result.missingSpanIds.length - 1);
    const updateContinuation = () => {
      if (hasContinuation()) {
        if (cursorLength() > 60000)
          throw new TracePageError('LIMIT_EXCEEDED', 'Trace continuation exceeds the cursor budget');
        result.nextCursor = Buffer.from(cursorPrefix + (offset + processed) + '}').toString('base64url');
      } else delete result.nextCursor;
      result.ancestorPaths = ancestorPaths();
    };
    for (const spanId of pageIds) {
      const record = recordsById.get(spanId);
      let addedBytes: number;
      if (!record) {
        if (topology && !selection.spanIds)
          throw new TracePageError('TRACE_CHANGED', 'Selected spans disappeared; restart this selection');
        result.missingSpanIds.push(spanId);
        addedBytes = Buffer.byteLength(JSON.stringify(spanId));
        missingIdBytes += addedBytes;
      } else {
        const { traceId, parentSpanId, name, spanType, isEvent, startedAt, endedAt, entityType, entityId, entityName } =
          record;
        const details = selection.include === 'full' ? { ...(record as SpanRecord) } : undefined;
        if (details) {
          delete details.scope;
          delete details.links;
        }
        const familyId = executionFamilyId(record);
        const displayParent = topology?.nodes.get(spanId)?.parentSpanId ?? null;
        const node: TracePageNode = {
          traceId,
          spanId,
          ...(familyId ? { executionFamilyId: familyId } : {}),
          ...(selection.flattenResumes ? { displayParentSpanId: displayParent } : {}),
          ...(familyId && summaries.has(familyId) ? { familySummary: summaries.get(familyId) } : {}),
          parentSpanId,
          name,
          spanType,
          isEvent,
          startedAt,
          endedAt,
          entityType,
          entityId,
          entityName,
          model: record.model,
          provider: record.provider,
          outcome: record.outcome,
          stopReason: record.stopReason,
          stopReasonContext: record.stopReasonContext,
          errorCount: record.errorCount,
          externalParentSpanId: record.externalParentSpanId,
          resumedFromSpanId: record.resumedFromSpanId,
          timeToFirstChunkMs: record.timeToFirstChunkMs,
          inputPreview: record.inputPreview,
          outputPreview: record.outputPreview,
          errorPreview: record.errorPreview,
          timeToFirstTokenMs: record.timeToFirstTokenMs,
          status: computeTraceStatus(record),
          childCount: topology ? (topology.children.get(spanId)?.length ?? 0) : null,
          match: topology?.matches.has(spanId) ?? false,
          parentState: !(selection.flattenResumes ? displayParent : parentSpanId)
            ? 'root'
            : !topology
              ? 'not-requested'
              : topology.nodes.has((selection.flattenResumes ? displayParent : parentSpanId)!)
                ? 'available'
                : 'unavailable',
          ...(details ? { details } : {}),
        };
        result.nodes.push(node);
        addedBytes = Buffer.byteLength(JSON.stringify(node));
        nodeBytes += addedBytes;
      }
      processed++;
      if (responseBytes() > selection.maxBytes) {
        if (record) {
          result.nodes.pop();
          nodeBytes -= addedBytes;
        } else {
          result.missingSpanIds.pop();
          missingIdBytes -= addedBytes;
        }
        processed--;
        if (!processed)
          throw new TracePageError(
            'PAYLOAD_TOO_LARGE',
            `Response metadata and the first result ('${spanId}') exceed maxBytes; increase maxBytes, request structure, or use the single-span endpoint`,
          );
        break;
      }
    }
    updateContinuation();
    if (responseBytes() > selection.maxBytes)
      throw new TracePageError('LIMIT_EXCEEDED', 'Trace response metadata exceeds maxBytes');
    return result;
  };

  if (selection.spanIds && !selection.flattenResumes && !selection.includeFamilySummary) {
    const ids = [...new Set(selection.spanIds)];
    const fingerprint = hash([source.scopeKey, traceId, selection]);
    return renderPage(ids, fingerprint);
  }
  const structure = await source.structure(traceId, 50001);
  if (!structure) return null;
  if (structure.length > 50000) throw new TracePageError('LIMIT_EXCEEDED', 'Trace topology exceeds 50000 spans');
  const nodes = new Map<string, TracePageStructure>();
  for (const node of structure) {
    if (node.traceId !== traceId || nodes.has(node.spanId) || !Number.isFinite(node.startedAt.getTime())) {
      throw new TracePageError('INVALID_TOPOLOGY', 'Trace contains conflicting identities or invalid timestamps');
    }
    nodes.set(node.spanId, node);
  }
  const visited = new Set<string>();
  for (const node of structure) {
    const path = new Set<string>();
    let current: TracePageStructure | undefined = node;
    while (current && !visited.has(current.spanId)) {
      if (path.has(current.spanId)) throw new TracePageError('INVALID_TOPOLOGY', 'Trace contains a parent cycle');
      path.add(current.spanId);
      current = current.parentSpanId ? nodes.get(current.parentSpanId) : undefined;
    }
    for (const spanId of path) visited.add(spanId);
  }
  const rawNodes = new Map(nodes);
  if (selection.flattenResumes) {
    for (const node of rawNodes.values()) {
      const original = node.resumedFromSpanId ? rawNodes.get(node.resumedFromSpanId) : undefined;
      if (
        node.spanType === 'agent_run' &&
        original?.spanType === 'agent_run' &&
        !original.resumedFromSpanId &&
        node.parentSpanId === original.spanId
      ) {
        nodes.set(node.spanId, { ...node, parentSpanId: original.parentSpanId });
      }
    }
  }
  const sorted = [...nodes.values()].sort(
    (a, b) => a.startedAt.getTime() - b.startedAt.getTime() || (a.spanId < b.spanId ? -1 : a.spanId > b.spanId ? 1 : 0),
  );
  // Same deterministic current-execution ordering as the rollup pilot: startedAt, spanId.
  for (const node of sorted) {
    const familyId = executionFamilyId(node);
    if (!familyId) continue;
    families.set(familyId, {
      current: node,
      count: (families.get(familyId)?.count ?? 0) + 1,
      originalAvailable: rawNodes.get(familyId)?.spanType === 'agent_run' && !rawNodes.get(familyId)?.resumedFromSpanId,
    });
  }
  const children = new Map<string, TracePageStructure[]>();
  const roots: TracePageStructure[] = [];
  for (const node of sorted) {
    if (node.parentSpanId && nodes.has(node.parentSpanId)) {
      const siblings = children.get(node.parentSpanId) ?? [];
      siblings.push(node);
      children.set(node.parentSpanId, siblings);
    } else roots.push(node);
  }
  const matches = new Set(selection.search ? await source.search!(traceId, selection.search) : []);
  if ([...matches].some(spanId => !nodes.has(spanId)))
    throw new TracePageError('TRACE_CHANGED', 'Search membership changed during the read; restart this selection');
  const selected: TracePageStructure[] = [];
  const missingSpanIds: string[] = [];
  if (selection.spanIds) {
    for (const id of new Set(selection.spanIds)) {
      const node = nodes.get(id);
      if (node) selected.push(node);
    }
  } else if (selection.search) {
    const emitted = new Set<string>();
    for (const match of sorted.filter(node => matches.has(node.spanId))) {
      const path: TracePageStructure[] = [];
      let current: TracePageStructure | undefined = match;
      while (current && !emitted.has(current.spanId)) {
        path.push(current);
        current = selection.ancestors !== false && current.parentSpanId ? nodes.get(current.parentSpanId) : undefined;
      }
      for (const node of path.reverse()) {
        emitted.add(node.spanId);
        selected.push(node);
      }
    }
  } else {
    const anchors = selection.anchorSpanId
      ? [nodes.get(selection.anchorSpanId)].filter((node): node is TracePageStructure => !!node)
      : roots;
    if (selection.anchorSpanId && !anchors.length) missingSpanIds.push(selection.anchorSpanId);
    const queue = anchors.map(node => ({ node, depth: 0 }));
    for (let i = 0; i < queue.length; i++) {
      const entry = queue[i]!;
      selected.push(entry.node);
      if (entry.depth < (selection.depth ?? 2)) {
        for (const child of children.get(entry.node.spanId) ?? []) queue.push({ node: child, depth: entry.depth + 1 });
      }
    }
  }
  const familyFingerprint = (familyId: string | undefined) => {
    const family = familyId ? families.get(familyId) : undefined;
    return family ? [family.current.spanId, family.count, family.originalAvailable] : null;
  };
  // Only changes affecting this selection invalidate continuation, not unrelated branches.
  const fingerprint = hash([
    source.scopeKey,
    traceId,
    selection,
    selected.map(node => [
      node.spanId,
      node.parentSpanId ?? null,
      rawNodes.get(node.spanId)?.parentSpanId ?? null,
      node.resumedFromSpanId ?? null,
      node.spanType,
      selection.includeFamilySummary ? familyFingerprint(executionFamilyId(node)) : null,
      node.startedAt.toISOString(),
      children.get(node.spanId)?.length ?? 0,
      !!node.parentSpanId && nodes.has(node.parentSpanId),
      matches.has(node.spanId),
    ]),
  ]);
  return renderPage(
    selection.spanIds ? [...new Set(selection.spanIds)] : selected.map(node => node.spanId),
    fingerprint,
    {
      nodes,
      rawNodes,
      children,
      matches,
      missingSpanIds,
      unavailableAncestors: selected.some(node => node.parentSpanId && !nodes.has(node.parentSpanId)),
    },
  );
}
