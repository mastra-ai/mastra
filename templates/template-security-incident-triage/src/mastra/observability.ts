import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import {
  SpanType,
  type AnySpan,
  type ObservabilityExporter,
  type SpanOutputProcessor,
  type TracingOptions,
} from '@mastra/core/observability';
import { RequestContext } from '@mastra/core/request-context';
import { MastraStorageExporter, Observability, SensitiveDataFilter } from '@mastra/observability';
import { z } from 'zod';

const categoricalAttributeValues = {
  toolType: new Set(['function']),
  source: new Set(['identity', 'endpoint', 'cloud']),
  status: new Set(['pending', 'running', 'success', 'partial', 'failed', 'error', 'suspended']),
  boundary: new Set([
    'http.webhook',
    'webhook.normalize',
    'incident.persist',
    'outbox.publish',
    'pubsub.consume',
    'workflow.start',
    'workflow.context',
    'gather.identity',
    'gather.endpoint',
    'gather.cloud',
    'agent.identity',
    'agent.endpoint',
    'agent.cloud',
    'retrieval.runbook',
    'severity.policy',
    'agent.response-planner',
    'containment.plan',
    'guardrail.plan',
    'approval.request',
    'provider.linear',
    'approval.await',
    'approval.decision',
    'approval.resume',
    'approval.expiry',
    'provider.containment',
    'containment.verify',
    'provider.linear.final',
    'incident.finalize',
    'workflow.cleanup',
    'triage.completed',
  ]),
} as const;
const opaqueAttributeKeys = [
  'workflowId',
  'provider',
  'model',
  'runId',
  'workflowRunId',
  'tenantId',
  'incidentId',
  'correlationId',
  'stepId',
  'toolId',
  'toolCallId',
  'requestId',
] as const;
const scopeKeys = ['tenantId', 'incidentId', 'runId', 'correlationId', 'requestId'] as const;
const traceMetadataKeys = {
  traceTenantId: 'tenantId',
  traceIncidentId: 'incidentId',
  traceRunId: 'runId',
  traceCorrelationId: 'correlationId',
  traceRequestId: 'requestId',
} as const;

type ScopeKey = (typeof scopeKeys)[number];
type SafeScope = Record<ScopeKey, string>;
type ProtectedTraceValue = Readonly<{
  kind: 'protected-trace-value-v1';
  value: string;
  proof: string;
}>;
type SafeSpanState = Readonly<{
  id: string;
  exportSpanId: string;
  traceId: string;
  exportTraceId: string;
  parent?: object;
  parentSpanId?: string;
  scope: SafeScope;
  identifiers: Record<string, string>;
  entityId?: string;
  type: SpanType;
  isEvent: boolean;
  startTimeMs: number;
  endTimeMs?: number;
}>;
type SpanIdentitySnapshot = Readonly<{
  id: unknown;
  traceId: unknown;
  parent: unknown;
  parentSpanId: unknown;
  type: unknown;
  startTime: unknown;
  endTime: unknown;
  isEvent: unknown;
}>;
type SpanEventSnapshot = Readonly<{
  identity: SpanIdentitySnapshot;
  name: unknown;
  type: unknown;
  entityId: unknown;
  startTime: unknown;
  endTime: unknown;
  isEvent: unknown;
  attributes: unknown;
  metadata: unknown;
  input: unknown;
  errorInfo: unknown;
}>;

const redactionKey = randomBytes(32);
const exportSpanIdsByObject = new WeakMap<object, string>();
const maximumSpanIdGenerationAttempts = 3;

export function getExportSpanId(span: object): string | undefined {
  return exportSpanIdsByObject.get(span);
}

/** Raw boundary: every external string is HMACed, regardless of its prefix. */
export function opaqueTraceValue(rawValue: string): string {
  return `opaque:v1:${createHmac('sha256', redactionKey).update(rawValue).digest('hex')}`;
}

function protectTraceValue(rawValue: string): ProtectedTraceValue {
  const value = opaqueTraceValue(rawValue);
  return Object.freeze({
    kind: 'protected-trace-value-v1' as const,
    value,
    proof: createHmac('sha256', redactionKey).update(`proof:${value}`).digest('hex'),
  });
}

function verifyProtectedTraceValue(value: unknown): string | undefined {
  if (read(value, 'kind') !== 'protected-trace-value-v1') return undefined;
  const opaque = read(value, 'value');
  const proof = read(value, 'proof');
  if (typeof opaque !== 'string' || typeof proof !== 'string') return undefined;
  const expected = createHmac('sha256', redactionKey).update(`proof:${opaque}`).digest('hex');
  const actualBuffer = Buffer.from(proof, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return undefined;
  return opaque;
}

export function createTraceCarrier(input: {
  tenantId: string;
  incidentId: string;
  runId: string;
  correlationId: string;
  requestId?: string;
}): {
  requestContext: RequestContext<unknown>;
  tracingOptions: TracingOptions;
} {
  const metadata = {
    traceTenantId: protectTraceValue(input.tenantId),
    traceIncidentId: protectTraceValue(input.incidentId),
    traceRunId: protectTraceValue(input.runId),
    traceCorrelationId: protectTraceValue(input.correlationId),
    traceRequestId: protectTraceValue(input.requestId ?? input.correlationId),
  };
  const requestContext = new RequestContext<unknown>();
  for (const [key, value] of Object.entries(metadata)) requestContext.set(key, value);
  return {
    requestContext,
    tracingOptions: { hideInput: true, hideOutput: true, metadata },
  };
}

function safeCategoricalValue(key: keyof typeof categoricalAttributeValues, value: unknown): string | undefined {
  return typeof value === 'string' && categoricalAttributeValues[key].has(value) ? value : undefined;
}

function scopedExportTraceId(traceId: string, scope: SafeScope): string {
  return createHmac('sha256', redactionKey)
    .update(
      JSON.stringify([
        'security-export-trace-v1',
        traceId,
        scope.tenantId,
        scope.incidentId,
        scope.runId,
        scope.correlationId,
      ]),
    )
    .digest('hex')
    .slice(0, 32);
}

function read(object: unknown, key: string): unknown {
  if ((typeof object !== 'object' || object === null) && typeof object !== 'function') return undefined;
  return Reflect.get(object, key);
}

function protectedScopeFromMetadata(metadata: unknown): SafeScope | undefined {
  const scope = {} as Partial<SafeScope>;
  for (const [metadataKey, scopeKey] of Object.entries(traceMetadataKeys)) {
    const value = verifyProtectedTraceValue(read(metadata, metadataKey));
    if (!value) return undefined;
    scope[scopeKey] = value;
  }
  return scope as SafeScope;
}

function rawScopeFromInput(input: unknown): SafeScope | undefined {
  const inputData = read(input, 'inputData');
  const candidate = inputData && typeof inputData === 'object' ? inputData : input;
  const tenantId = read(candidate, 'tenantId');
  const incidentId = read(candidate, 'incidentId');
  const correlationId = read(candidate, 'correlationId');
  const requestId = read(candidate, 'requestId') ?? correlationId;
  const runId = read(candidate, 'workflowRunId') ?? read(candidate, 'runId') ?? read(candidate, 'eventId');
  if (
    typeof tenantId !== 'string' ||
    typeof incidentId !== 'string' ||
    typeof runId !== 'string' ||
    typeof correlationId !== 'string' ||
    typeof requestId !== 'string'
  )
    return undefined;
  return {
    tenantId: opaqueTraceValue(tenantId),
    incidentId: opaqueTraceValue(incidentId),
    runId: opaqueTraceValue(runId),
    correlationId: opaqueTraceValue(correlationId),
    requestId: opaqueTraceValue(requestId),
  };
}

function cloneDate(value: unknown): Date | undefined {
  if (!(value instanceof Date)) return undefined;
  const time = Date.prototype.getTime.call(value);
  return Number.isFinite(time) ? new Date(time) : undefined;
}

function createSafeSpanEnvelope(input: {
  id: string;
  traceId: string;
  parentSpanId?: string;
  name: string;
  type: SpanType;
  entityId?: string;
  startTime: Date;
  endTime?: Date;
  isEvent: boolean;
  attributes: Record<string, unknown>;
  errorInfo?: { message: string };
}): AnySpan {
  const isRootSpan = input.parentSpanId === undefined;
  const envelope = {
    id: input.id,
    traceId: input.traceId,
    name: input.name,
    type: input.type,
    entityType: undefined,
    entityId: input.entityId,
    entityName: undefined,
    startTime: input.startTime,
    endTime: input.endTime,
    attributes: input.attributes,
    metadata: undefined,
    tags: undefined,
    input: undefined,
    output: undefined,
    errorInfo: input.errorInfo,
    requestContext: undefined,
    traceState: undefined,
    isEvent: input.isEvent,
    isInternal: false,
    isRootSpan,
    parent: undefined,
    get isValid() {
      return true;
    },
    get externalTraceId() {
      return input.traceId;
    },
    getExportedSpanId: () => input.id,
    getParentSpanId: () => input.parentSpanId,
    exportSpan: () => ({
      id: input.id,
      traceId: input.traceId,
      name: input.name,
      type: input.type,
      entityType: undefined,
      entityId: envelope.entityId,
      entityName: undefined,
      startTime: new Date(input.startTime.getTime()),
      endTime: input.endTime ? new Date(input.endTime.getTime()) : undefined,
      attributes: envelope.attributes as never,
      metadata: undefined,
      tags: undefined,
      input: undefined,
      output: undefined,
      errorInfo: envelope.errorInfo,
      requestContext: undefined,
      isEvent: input.isEvent,
      isRootSpan,
      parentSpanId: input.parentSpanId,
    }),
  };
  return envelope as unknown as AnySpan;
}

/** Total, fail-closed trace export boundary. */
export class TraceRedactionProcessor implements SpanOutputProcessor {
  readonly name = 'security-trace-redaction';
  private readonly safeSpans = new WeakMap<object, SafeSpanState>();
  private readonly rejectedSpans = new WeakSet<object>();
  private readonly reservedExportSpanIds = new Set<string>();
  private readonly exportSpanIdFinalizer = new FinalizationRegistry<string>(exportSpanId =>
    this.reservedExportSpanIds.delete(exportSpanId),
  );
  private readonly generateSpanId: () => string;

  constructor(options: { generateSpanId?: () => string } = {}) {
    this.generateSpanId = options.generateSpanId ?? (() => randomBytes(8).toString('hex'));
  }

  private allocateExportSpanId(span: object): string | undefined {
    for (let attempt = 0; attempt < maximumSpanIdGenerationAttempts; attempt += 1) {
      const candidate = this.generateSpanId();
      if (
        typeof candidate !== 'string' ||
        !/^[a-f0-9]{16}$/u.test(candidate) ||
        candidate === '0000000000000000' ||
        this.reservedExportSpanIds.has(candidate)
      )
        continue;
      this.reservedExportSpanIds.add(candidate);
      this.exportSpanIdFinalizer.register(span, candidate);
      exportSpanIdsByObject.set(span, candidate);
      return candidate;
    }
    return undefined;
  }

  private reject(span: object): undefined {
    this.safeSpans.delete(span);
    this.rejectedSpans.add(span);
    return undefined;
  }

  private captureIdentity(span: object): SpanIdentitySnapshot {
    return {
      id: read(span, 'id'),
      traceId: read(span, 'traceId'),
      parent: read(span, 'parent'),
      parentSpanId: read(span, 'parentSpanId'),
      type: read(span, 'type'),
      startTime: read(span, 'startTime'),
      endTime: read(span, 'endTime'),
      isEvent: read(span, 'isEvent'),
    };
  }

  private captureEvent(span: object): SpanEventSnapshot {
    const identity = this.captureIdentity(span);
    return {
      identity,
      name: read(span, 'name'),
      type: identity.type,
      entityId: read(span, 'entityId'),
      startTime: identity.startTime,
      endTime: identity.endTime,
      isEvent: identity.isEvent,
      attributes: read(span, 'attributes'),
      metadata: read(span, 'metadata'),
      input: read(span, 'input'),
      errorInfo: read(span, 'errorInfo'),
    };
  }

  private validateState(
    span: object,
    state: SafeSpanState,
    snapshots: WeakMap<object, SpanIdentitySnapshot>,
    visited = new WeakSet<object>(),
    allowEndTransition = false,
  ): boolean {
    if (visited.has(span) || this.rejectedSpans.has(span)) return false;
    visited.add(span);
    try {
      const snapshot = snapshots.get(span) ?? this.captureIdentity(span);
      snapshots.set(span, snapshot);
      const startTime = cloneDate(snapshot.startTime);
      const endTime = snapshot.endTime === undefined ? undefined : cloneDate(snapshot.endTime);
      const endTimeMs = endTime?.getTime();
      if (
        snapshot.id !== state.id ||
        snapshot.traceId !== state.traceId ||
        snapshot.parent !== state.parent ||
        snapshot.parentSpanId !== state.parentSpanId ||
        snapshot.type !== state.type ||
        snapshot.isEvent !== state.isEvent ||
        startTime?.getTime() !== state.startTimeMs ||
        (snapshot.endTime !== undefined && endTime === undefined) ||
        (!allowEndTransition && endTimeMs !== state.endTimeMs) ||
        (state.endTimeMs !== undefined && endTimeMs !== state.endTimeMs) ||
        (endTimeMs !== undefined && endTimeMs < state.startTimeMs)
      ) {
        this.reject(span);
        return false;
      }
      if (state.parent) {
        const parentState = this.safeSpans.get(state.parent);
        if (!parentState || !this.validateState(state.parent, parentState, snapshots, visited)) {
          this.reject(span);
          return false;
        }
      }
      return true;
    } catch {
      this.reject(span);
      return false;
    }
  }

  process(span?: AnySpan): AnySpan | undefined {
    if (!span) return undefined;
    if (this.rejectedSpans.has(span)) return undefined;
    try {
      const snapshot = this.captureEvent(span);
      const snapshots = new WeakMap<object, SpanIdentitySnapshot>();
      snapshots.set(span, snapshot.identity);
      const previous = this.safeSpans.get(span);
      if (previous && !this.validateState(span, previous, snapshots, new WeakSet(), true)) return undefined;
      const { id, traceId, parent, parentSpanId } = snapshot.identity;
      if (typeof id !== 'string' || typeof traceId !== 'string') return this.reject(span);
      if (
        (parent !== undefined && (typeof parent !== 'object' || parent === null)) ||
        (parentSpanId !== undefined && typeof parentSpanId !== 'string')
      )
        return this.reject(span);
      const parentState = parent && !this.rejectedSpans.has(parent) ? this.safeSpans.get(parent) : undefined;
      if (parentState && !this.validateState(parent as object, parentState, snapshots)) return this.reject(span);
      if (parentState && typeof parentSpanId === 'string' && parentSpanId !== parentState.id) return this.reject(span);
      if (parentState && traceId !== parentState.traceId) return this.reject(span);
      // A span resumed from an outbox, PubSub message, or approval token has a
      // `parentSpanId` but not an in-memory parent object.  It is still safe
      // to accept it only when it carries a complete independently-redacted
      // scope.  The previous implementation rejected those real async hops,
      // silently making the exported trace look like it ended at the process
      // boundary.
      const scope =
        previous?.scope ??
        (parent !== undefined
          ? parentState?.scope
          : (protectedScopeFromMetadata(snapshot.metadata) ?? rawScopeFromInput(snapshot.input)));
      if (!scope) {
        return this.reject(span);
      }

      const rawAttributes = snapshot.attributes;
      const attributes: Record<string, unknown> = { ...scope };
      const success = read(rawAttributes, 'success');
      if (typeof success === 'boolean') attributes.success = success;
      const attempt = read(rawAttributes, 'attempt');
      if (typeof attempt === 'number' && Number.isInteger(attempt) && attempt >= 1 && attempt <= 2)
        attributes.attempt = attempt;
      for (const key of Object.keys(categoricalAttributeValues) as (keyof typeof categoricalAttributeValues)[]) {
        const value = safeCategoricalValue(key, read(rawAttributes, key));
        if (value !== undefined) attributes[key] = value;
      }
      const identifiers = { ...(previous?.identifiers ?? {}) };
      if (!previous) {
        for (const key of opaqueAttributeKeys) {
          if (scopeKeys.includes(key as ScopeKey)) continue;
          const rawValue = read(rawAttributes, key);
          if (typeof rawValue === 'string') identifiers[key] = opaqueTraceValue(rawValue);
        }
        const spanType = snapshot.type;
        const spanName = snapshot.name;
        if (spanType === SpanType.WORKFLOW_STEP && typeof spanName === 'string' && identifiers.stepId === undefined)
          identifiers.stepId = opaqueTraceValue(spanName);
      }
      Object.assign(attributes, identifiers);

      const rawEntityId = snapshot.entityId;
      const entityId =
        previous?.entityId ?? (typeof rawEntityId === 'string' ? opaqueTraceValue(rawEntityId) : undefined);
      const errorInfo = snapshot.errorInfo;

      const type = snapshot.type;
      if (!Object.values(SpanType).includes(type as SpanType)) return this.reject(span);
      const name = `security-${String(type)}`;
      const startTime = cloneDate(snapshot.startTime);
      const endTime = snapshot.endTime === undefined ? undefined : cloneDate(snapshot.endTime);
      if (
        !startTime ||
        (snapshot.endTime !== undefined && endTime === undefined) ||
        typeof snapshot.isEvent !== 'boolean'
      )
        return this.reject(span);
      const startTimeMs = startTime.getTime();
      const endTimeMs = endTime?.getTime();
      if (
        (previous &&
          (startTimeMs !== previous.startTimeMs || type !== previous.type || snapshot.isEvent !== previous.isEvent)) ||
        (!previous && endTimeMs !== undefined) ||
        (previous?.endTimeMs !== undefined && endTimeMs !== previous.endTimeMs) ||
        (endTimeMs !== undefined && endTimeMs < startTimeMs)
      )
        return this.reject(span);
      const exportTraceId =
        previous?.exportTraceId ?? parentState?.exportTraceId ?? scopedExportTraceId(traceId, scope);
      // Workflow tracing persists parentage across process boundaries. Mastra's own
      // span ids are random opaque 16-hex capabilities and are the ids its
      // documented resume API accepts; retaining them for these explicit
      // boundary spans lets a later runtime link a child to the durable
      // parent. Other spans keep the exporter-generated identifier.
      const workflowBoundary = safeCategoricalValue('boundary', read(rawAttributes, 'boundary'));
      const exportSpanId = previous?.exportSpanId ?? (workflowBoundary ? id : this.allocateExportSpanId(span));
      if (!exportSpanId) return this.reject(span);

      this.safeSpans.set(span, {
        id,
        exportSpanId,
        traceId,
        exportTraceId,
        ...(parent && typeof parent === 'object' ? { parent } : {}),
        ...(typeof parentSpanId === 'string' ? { parentSpanId } : {}),
        scope,
        identifiers,
        ...(entityId ? { entityId } : {}),
        type: type as SpanType,
        isEvent: snapshot.isEvent,
        startTimeMs,
        ...(endTimeMs !== undefined ? { endTimeMs } : {}),
      });
      return createSafeSpanEnvelope({
        id: exportSpanId,
        traceId: exportTraceId,
        ...(parentState
          ? { parentSpanId: parentState.exportSpanId }
          : typeof parentSpanId === 'string'
            ? { parentSpanId }
            : {}),
        name,
        type: type as SpanType,
        ...(entityId ? { entityId } : {}),
        startTime: new Date(previous?.startTimeMs ?? startTimeMs),
        ...(endTime ? { endTime } : {}),
        isEvent: snapshot.isEvent,
        attributes,
        ...(errorInfo
          ? {
              errorInfo: {
                message: 'redacted',
              },
            }
          : {}),
      });
    } catch {
      return this.reject(span);
    }
  }

  async shutdown(): Promise<void> {
    this.reservedExportSpanIds.clear();
  }
}

export function createSecurityObservability(
  exporters: ObservabilityExporter[] = [new MastraStorageExporter()],
): Observability {
  return new Observability({
    sensitiveDataFilter: false,
    configs: {
      security: {
        serviceName: 'security-incident-triage',
        exporters,
        spanOutputProcessors: [new TraceRedactionProcessor(), new SensitiveDataFilter({ redactionStyle: 'full' })],
        requestContextKeys: Object.keys(traceMetadataKeys),
        includeInternalSpans: false,
        logging: { enabled: false },
      },
    },
  });
}

/**
 * The production singleton is the default boundary sink. Local runs
 * temporarily install a run-owned instance so that the same product
 * boundaries write to their isolated observability database instead of the
 * process-wide default.  The restore callback is deliberately compare-and-set
 * so a stale runtime cannot clobber a later installation.
 */
export const observability = createSecurityObservability();

export type WorkflowTraceContext = Readonly<{
  traceId: string;
  /**
   * This is the already-sanitized exported parent span id. It is safe to put
   * in a durable envelope and lets a later process retain exported parentage
   * without reconstructing an in-memory Mastra span.
   */
  parentSpanId?: string;
  /**
   * Immutable trace scope. Operational run ids may legitimately be rebound at
   * an outbox boundary; this preserves the redacted trace identity across
   * that transport hop without carrying payload content.
   */
  scope?: Readonly<{
    tenantId: string;
    incidentId: string;
    runId: string;
    correlationId: string;
    requestId: string;
  }>;
}>;

/**
 * The only trace context permitted in a durable outbox/PubSub envelope.
 * Trace/span IDs are opaque transport capabilities, while run/request remain
 * bounded identifiers which are subsequently bound to the source envelope.
 */
const opaqueCarrierIdSchema = z
  .string()
  .min(1)
  .max(128)
  .refine(
    value => ![...value].some(character => character.charCodeAt(0) < 32),
    'SECURITY_EVAL_TRACE_CARRIER_CONTROL_CHARACTER',
  );

export const WorkflowTraceCarrierSchema = z
  .object({
    traceId: opaqueCarrierIdSchema,
    parentSpanId: opaqueCarrierIdSchema.optional(),
    runId: opaqueCarrierIdSchema,
    requestId: opaqueCarrierIdSchema,
    scope: z
      .object({
        tenantId: opaqueCarrierIdSchema,
        incidentId: opaqueCarrierIdSchema,
        runId: opaqueCarrierIdSchema,
        correlationId: opaqueCarrierIdSchema,
        requestId: opaqueCarrierIdSchema,
      })
      .strict()
      .optional(),
  })
  .strict();
export type WorkflowTraceCarrier = z.infer<typeof WorkflowTraceCarrierSchema>;

/**
 * Starts an official Mastra span and returns only random opaque identifiers
 * suitable for durable outbox/PubSub propagation. No payload or secret is put
 * in the transport context.
 */
export function startWorkflowBoundary(input: {
  boundary: typeof categoricalAttributeValues.boundary extends Set<infer T> ? T : never;
  tenantId: string;
  incidentId: string;
  runId: string;
  correlationId: string;
  requestId: string;
  /** Safe identifiers are HMACed by the existing exporter before persistence. */
  identifiers?: Readonly<{
    stepId?: string;
    toolCallId?: string;
    provider?: string;
  }>;
  context?: WorkflowTraceContext;
  /** Used by isolated runtime tests; production uses the registered runtime. */
  observabilityInstance?: Observability;
}) {
  const activeObservability = input.observabilityInstance ?? observability;
  const instance = activeObservability.getDefaultInstance();
  if (!instance) throw new Error('SECURITY_EVAL_OBSERVABILITY_UNAVAILABLE');
  const scope =
    input.context?.scope ??
    Object.freeze({
      tenantId: input.tenantId,
      incidentId: input.incidentId,
      runId: input.runId,
      correlationId: input.correlationId,
      requestId: input.requestId,
    });
  const replayStart = nextSecurityEvalReplayTraceTime();
  const span = instance.startSpan({
    name: input.boundary,
    type: SpanType.GENERIC,
    ...(input.context?.traceId ? { traceId: input.context.traceId } : {}),
    ...(input.context?.parentSpanId ? { parentSpanId: input.context.parentSpanId } : {}),
    attributes: { boundary: input.boundary, ...input.identifiers } as never,
    input: {
      tenantId: scope.tenantId,
      incidentId: scope.incidentId,
      workflowRunId: scope.runId,
      correlationId: scope.correlationId,
      requestId: scope.requestId,
    },
    ...(replayStart ? { startTime: replayStart } : {}),
  } as never);
  if (replayStart) {
    // The hermetic report sets this only before it executes the real E2E.
    // The official span therefore *produces* replay-clock measurements at its
    // lifecycle boundary; no report consumer is permitted to rewrite them.
    const emitter = instance as unknown as {
      emitSpanEnded(span: object): void;
    };
    span.end = options => {
      const replayEnd = nextSecurityEvalReplayTraceTime();
      if (!replayEnd) return;
      if (span.endTime) return;
      span.endTime = replayEnd;
      if (options?.attributes) span.attributes = { ...span.attributes, ...options.attributes };
      if (options?.output !== undefined) span.output = options.output;
      // `emitSpanEnded` is the documented runtime's own lifecycle sink; this
      // preserves the official processor/exporter path while the replay clock
      // supplies the measurement at production time.
      emitter.emitSpanEnded(span);
    };
  }
  // Output processors are invoked by Mastra as the span is started.  Carry
  // their opaque id across durable boundaries, never the raw internal id.
  // The carrier uses the native Mastra id, not an exporter-only alias.  This
  // is required by Mastra's documented suspended-span parent API and remains
  // opaque/random rather than payload-derived.
  const exportedSpanId = span.id;
  return Object.freeze({
    span,
    context: Object.freeze({
      traceId: span.traceId,
      ...(exportedSpanId ? { parentSpanId: exportedSpanId } : {}),
      scope,
    }),
  });
}

let securityEvalReplayTraceClock: { anchor: string; nextMs: number } | undefined;

/**
 * Source clock for the report's offline replay. It is intentionally opt-in:
 * product telemetry continues to use the system clock unless the report sets
 * this process-local fixture anchor before executing the actual workflow.
 */
function nextSecurityEvalReplayTraceTime(): Date | undefined {
  const anchor = process.env.SECURITY_EVAL_REPRODUCIBLE_TRACE_CLOCK;
  if (!anchor) return undefined;
  if (securityEvalReplayTraceClock?.anchor !== anchor) {
    const start = Date.parse(anchor);
    if (!Number.isFinite(start)) throw new Error('SECURITY_EVAL_REPLAY_TRACE_CLOCK_INVALID');
    securityEvalReplayTraceClock = { anchor, nextMs: start };
  }
  const value = new Date(securityEvalReplayTraceClock.nextMs);
  securityEvalReplayTraceClock.nextMs += 1;
  return value;
}
