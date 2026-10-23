export type SanitizedTraceBoundary = Readonly<{
  spanId: string;
  traceId: string;
  name: string;
  parentSpanId?: string;
  startMs: number;
  endMs?: number;
  attributes: Readonly<Record<string, unknown>>;
}>;
export type TraceContextManifest = Readonly<{
  version: 'security-eval-trace-v1';
  scenario: 'privilege' | 'country' | 'device';
  disposition: 'approved' | 'rejected' | 'expired';
  required: readonly string[];
  cardinalities: Readonly<Record<string, Readonly<[number, number]>>>;
  /** Siblings which must overlap in wall-clock time, not merely start nearby. */
  parallelSiblings: readonly Readonly<{
    parent: string;
    boundaries: readonly string[];
  }>[];
  requiredIdentifiers: Readonly<Record<string, readonly string[]>>;
  /** Every non-root boundary has one declared causal parent. */
  parents: Readonly<Record<string, string | undefined>>;
  orderedAfter: readonly Readonly<[string, string]>[];
  forbidden: readonly string[];
}>;

const commonRequired = [
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
  'containment.plan',
  'guardrail.plan',
  'approval.request',
  'provider.linear',
  'approval.await',
  'approval.resume',
  'workflow.cleanup',
  'triage.completed',
] as const;

export function traceContextManifest(
  scenario: TraceContextManifest['scenario'],
  disposition: TraceContextManifest['disposition'],
): TraceContextManifest {
  const terminalOrder: readonly (readonly [string, string])[] =
    disposition === 'approved'
      ? [
          ['approval.await', 'approval.decision'],
          ['approval.decision', 'approval.resume'],
          ['approval.resume', 'provider.containment'],
          ['provider.containment', 'containment.verify'],
          ['containment.verify', 'provider.linear.final'],
          ['provider.linear.final', 'workflow.cleanup'],
          ['workflow.cleanup', 'triage.completed'],
        ]
      : disposition === 'expired'
        ? [
            ['approval.await', 'approval.expiry'],
            ['approval.expiry', 'approval.resume'],
            ['approval.resume', 'workflow.cleanup'],
            ['workflow.cleanup', 'triage.completed'],
          ]
        : [
            ['approval.await', 'approval.decision'],
            ['approval.decision', 'approval.resume'],
            ['approval.resume', 'provider.linear.final'],
            ['provider.linear.final', 'workflow.cleanup'],
            ['workflow.cleanup', 'triage.completed'],
          ];
  const orderedAfter: readonly (readonly [string, string])[] = [
    ['http.webhook', 'webhook.normalize'],
    ['webhook.normalize', 'incident.persist'],
    ['incident.persist', 'outbox.publish'],
    ['outbox.publish', 'pubsub.consume'],
    ['pubsub.consume', 'workflow.start'],
    ['workflow.start', 'workflow.context'],
    ['workflow.context', 'gather.identity'],
    ['workflow.context', 'gather.endpoint'],
    ['workflow.context', 'gather.cloud'],
    ['workflow.context', 'retrieval.runbook'],
    ['retrieval.runbook', 'severity.policy'],
    ['severity.policy', 'containment.plan'],
    ['containment.plan', 'guardrail.plan'],
    ['guardrail.plan', 'approval.request'],
    ['approval.request', 'provider.linear'],
    ['provider.linear', 'approval.await'],
    ['approval.await', 'approval.resume'],
    ...terminalOrder,
  ];
  return Object.freeze({
    version: 'security-eval-trace-v1',
    scenario,
    disposition,
    required: [
      ...commonRequired,
      ...(disposition === 'expired' ? ['approval.expiry'] : ['approval.decision']),
      ...(disposition === 'approved'
        ? ['provider.containment', 'containment.verify', 'provider.linear.final']
        : disposition === 'rejected'
          ? ['provider.linear.final']
          : []),
    ],
    parents: Object.freeze({
      'http.webhook': undefined,
      'webhook.normalize': 'http.webhook',
      'incident.persist': 'webhook.normalize',
      'outbox.publish': 'incident.persist',
      'pubsub.consume': 'outbox.publish',
      'workflow.start': 'pubsub.consume',
      'workflow.context': 'workflow.start',
      'gather.identity': 'workflow.context',
      'gather.endpoint': 'workflow.context',
      'gather.cloud': 'workflow.context',
      'agent.identity': 'workflow.context',
      'agent.endpoint': 'workflow.context',
      'agent.cloud': 'workflow.context',
      'retrieval.runbook': 'workflow.context',
      'severity.policy': 'retrieval.runbook',
      'containment.plan': 'severity.policy',
      'guardrail.plan': 'containment.plan',
      'approval.request': 'guardrail.plan',
      'provider.linear': 'approval.request',
      'approval.await': 'provider.linear',
      ...(disposition === 'expired'
        ? {
            // Expiry is driven by the durable expiry dispatcher, not a human
            // decision endpoint; it descends directly from the suspended
            // approval boundary.
            'approval.expiry': 'approval.await',
            'approval.resume': 'approval.expiry',
            'workflow.cleanup': 'approval.resume',
            'triage.completed': 'workflow.cleanup',
          }
        : {
            'approval.decision': 'approval.await',
            'approval.resume': 'approval.decision',
            ...(disposition === 'approved'
              ? {
                  'provider.containment': 'approval.resume',
                  'containment.verify': 'provider.containment',
                  'provider.linear.final': 'containment.verify',
                  'workflow.cleanup': 'provider.linear.final',
                  'triage.completed': 'workflow.cleanup',
                }
              : {
                  'provider.linear.final': 'approval.resume',
                  'workflow.cleanup': 'provider.linear.final',
                  'triage.completed': 'workflow.cleanup',
                }),
          }),
    }),
    cardinalities: Object.freeze({
      ...Object.fromEntries(commonRequired.map(name => [name, [1, 1] as const])),
      ...(disposition === 'approved'
        ? {
            'approval.decision': [1, 1] as const,
            'provider.containment': [1, 32] as const,
            'containment.verify': [1, 1] as const,
            'provider.linear.final': [1, 1] as const,
          }
        : disposition === 'expired'
          ? { 'approval.expiry': [1, 1] as const }
          : {
              'approval.decision': [1, 1] as const,
              'provider.linear.final': [1, 1] as const,
            }),
    }),
    parallelSiblings: Object.freeze([
      Object.freeze({
        parent: 'workflow.context',
        boundaries: Object.freeze(['gather.identity', 'gather.endpoint', 'gather.cloud']),
      }),
    ]),
    requiredIdentifiers: Object.freeze({
      'gather.identity': ['stepId', 'toolCallId', 'provider'],
      'gather.endpoint': ['stepId', 'toolCallId', 'provider'],
      'gather.cloud': ['stepId', 'toolCallId', 'provider'],
      'agent.identity': ['stepId', 'toolCallId', 'provider'],
      'agent.endpoint': ['stepId', 'toolCallId', 'provider'],
      'agent.cloud': ['stepId', 'toolCallId', 'provider'],
      'retrieval.runbook': ['stepId', 'provider'],
      'severity.policy': ['stepId', 'provider'],
      'containment.plan': ['stepId', 'provider'],
      'guardrail.plan': ['stepId'],
      'approval.request': ['stepId'],
      'incident.persist': ['stepId'],
      'webhook.normalize': ['stepId'],
      'provider.linear': ['stepId', 'provider'],
      'approval.await': ['stepId', 'provider'],
      'approval.decision': ['stepId', 'provider'],
      'approval.expiry': ['stepId', 'provider'],
      'provider.containment': ['toolCallId', 'provider'],
      'containment.verify': ['stepId'],
      'provider.linear.final': ['stepId', 'provider'],
      'workflow.cleanup': ['stepId'],
    }),
    orderedAfter,
    forbidden: disposition === 'approved' ? [] : ['provider.containment'],
  });
}
const forbidden =
  /authorization|cookie|token|secret|password|apikey|body|prompt|output|email|ip|name|evidence|chain.?of.?thought/iu;
const allowedAttributeKeys = new Set([
  'tenantId',
  'requestId',
  'correlationId',
  'incidentId',
  'runId',
  'workflowRunId',
  'stepId',
  'toolCallId',
  'provider',
  'status',
  'causationId',
  'boundary',
  'success',
]);
export function validateTraceContext(
  boundaries: readonly SanitizedTraceBoundary[],
  required: readonly string[],
  forbiddenNames: readonly string[] = [],
): readonly string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const names = new Set<string>();
  const traceIds = new Set<string>();
  for (const span of boundaries) {
    if (ids.has(span.spanId)) errors.push(`duplicate-id:${span.spanId}`);
    ids.add(span.spanId);
    // Containment can execute multiple approved actions.  Those provider
    // calls are distinct evidence, not duplicate lifecycle boundaries.
    if (names.has(span.name) && span.name !== 'provider.containment') errors.push(`duplicate:${span.name}`);
    names.add(span.name);
    traceIds.add(span.traceId);
    if (
      !span.traceId ||
      !span.spanId ||
      !Number.isFinite(span.startMs) ||
      !Number.isFinite(span.endMs) ||
      span.endMs === undefined ||
      span.endMs < span.startMs
    )
      errors.push(`time:${span.name}`);
    if (span.parentSpanId && !boundaries.some(candidate => candidate.spanId === span.parentSpanId))
      errors.push(`orphan:${span.name}`);
    for (const [key, value] of Object.entries(span.attributes))
      if (
        !allowedAttributeKeys.has(key) ||
        forbidden.test(key) ||
        (typeof value === 'string' && forbidden.test(value)) ||
        (key === 'boundary'
          ? typeof value !== 'string'
          : key === 'success'
            ? typeof value !== 'boolean'
            : typeof value !== 'string' || !value.startsWith('opaque:v1:'))
      )
        errors.push(`redaction:${span.name}:${key}`);
    for (const key of ['tenantId', 'incidentId', 'runId', 'correlationId', 'requestId', 'boundary'])
      if (!(key in span.attributes)) errors.push(`attribute:${span.name}:${key}`);
  }
  if (traceIds.size !== 1) errors.push('trace-mismatch');
  const roots = boundaries.filter(span => !span.parentSpanId);
  if (roots.length !== 1) errors.push(`roots:${roots.length}`);
  for (const span of boundaries) {
    const seen = new Set<string>();
    let current = span;
    while (current.parentSpanId) {
      if (seen.has(current.spanId)) {
        errors.push(`cycle:${span.name}`);
        break;
      }
      seen.add(current.spanId);
      const parent = boundaries.find(candidate => candidate.spanId === current.parentSpanId);
      if (!parent) break;
      current = parent;
    }
  }
  for (const name of required) if (!names.has(name)) errors.push(`missing:${name}`);
  for (const name of forbiddenNames) if (names.has(name)) errors.push(`forbidden:${name}`);
  return Object.freeze([...new Set(errors)]);
}

/** Validates the versioned scenario contract and scans every exported surface. */
export function validateTraceManifest(
  boundaries: readonly SanitizedTraceBoundary[],
  manifest: TraceContextManifest,
  surfaces: readonly string[],
  canaries: readonly string[],
): readonly string[] {
  const errors = [...validateTraceContext(boundaries, manifest.required, manifest.forbidden)];
  const byName = new Map(boundaries.map(span => [span.name, span]));
  for (const [name, [minimum, maximum]] of Object.entries(manifest.cardinalities)) {
    const count = boundaries.filter(span => span.name === name).length;
    if (count < minimum || count > maximum) errors.push(`cardinality:${name}:${count}`);
  }
  for (const [name, keys] of Object.entries(manifest.requiredIdentifiers))
    for (const span of boundaries.filter(candidate => candidate.name === name))
      for (const key of keys) if (!(key in span.attributes)) errors.push(`identifier:${name}:${key}`);
  for (const [name, parentName] of Object.entries(manifest.parents)) {
    const span = byName.get(name);
    const parent = parentName ? byName.get(parentName) : undefined;
    if (!span) continue;
    if (!parentName) {
      if (span.parentSpanId) errors.push(`parent:${name}:root`);
    } else if (
      name === 'provider.containment' &&
      !boundaries.some(
        candidate =>
          candidate.spanId === span.parentSpanId &&
          (candidate.name === 'provider.containment' || candidate.name === parentName),
      )
    ) {
      errors.push(`parent:${name}:${parentName}`);
    } else if (name !== 'provider.containment' && (!parent || span.parentSpanId !== parent.spanId)) {
      errors.push(`parent:${name}:${parentName}`);
    }
  }
  for (const [before, after] of manifest.orderedAfter) {
    const left = byName.get(before);
    const right = byName.get(after);
    // Product boundary spans are intentionally nested around their async
    // children (consume surrounds workflow start; decision surrounds resume),
    // so causal order is their start order rather than a non-overlap claim.
    if (!left || !right || left.startMs > right.startMs) errors.push(`order:${before}:${after}`);
  }
  for (const parallel of manifest.parallelSiblings) {
    const siblings = parallel.boundaries.map(name => byName.get(name));
    if (siblings.some(span => !span)) {
      errors.push(`parallel:missing:${parallel.parent}`);
      continue;
    }
    const concrete = siblings as SanitizedTraceBoundary[];
    if (concrete.some(span => span.parentSpanId !== byName.get(parallel.parent)?.spanId))
      errors.push(`parallel:parent:${parallel.parent}`);
    // Half-open intervals overlap iff the latest start is strictly before the
    // earliest end. Equality is serial execution and must not satisfy gather.
    const latestStart = Math.max(...concrete.map(span => span.startMs));
    const earliestEnd = Math.min(...concrete.map(span => span.endMs ?? -1));
    if (!(latestStart < earliestEnd)) errors.push(`parallel:overlap:${parallel.parent}`);
  }
  const trace = boundaries[0]?.traceId;
  for (const span of boundaries) if (span.traceId !== trace) errors.push(`correlation:${span.name}`);
  for (const canary of canaries)
    if (surfaces.some(surface => surface.includes(canary))) errors.push(`canary:${canary}`);
  return Object.freeze([...new Set(errors)]);
}
