/**
 * Turns a raw span into a human readable sentence.
 *
 * Resolution order (see the plan's decision 7):
 *  1. `spanType` + structured fields (`entityId`, typed `attributes`)
 *  2. fallback: regex over the display-name patterns emitted by the core
 *  3. last resort: the raw span name
 */
export type HumanizableSpan = {
  name?: string | null;
  spanType?: string | null;
  entityId?: string | null;
  entityType?: string | null;
  attributes?: Record<string, unknown> | null;
};

const TOOL_TYPES = new Set(['tool_call', 'client_tool_call', 'provider_tool_call', 'mcp_tool_call']);

function agent(id: string) {
  return `Called agent ${id}`;
}
function tool(id: string) {
  return `Used tool ${id}`;
}
function processor(id: string) {
  return `Ran processor ${id}`;
}
function workflow(id: string) {
  return `Ran workflow ${id}`;
}
function workflowStep(id: string) {
  return `Workflow step ${id}`;
}
function model(id: string) {
  return `Generated with model ${id}`;
}
function workspace(category: string, operation: string) {
  return `Workspace ${category}: ${operation}`;
}

function fromStructuredFields(span: HumanizableSpan): string | undefined {
  const type = span.spanType ?? undefined;
  const entityId = span.entityId || undefined;
  const attributes = span.attributes ?? undefined;

  if (!type) return undefined;

  if (TOOL_TYPES.has(type)) {
    return entityId ? tool(entityId) : undefined;
  }

  switch (type) {
    case 'agent_run':
      return entityId ? agent(entityId) : undefined;
    case 'model_generation': {
      const modelId = typeof attributes?.model === 'string' ? attributes.model : entityId;
      return modelId ? model(modelId) : undefined;
    }
    case 'processor_run':
      return entityId ? processor(entityId) : undefined;
    case 'workflow_run':
      return entityId ? workflow(entityId) : undefined;
    case 'workflow_step':
      return entityId ? workflowStep(entityId) : undefined;
    default:
      return undefined;
  }
}

const PATTERNS: Array<{ pattern: RegExp; format: (match: RegExpMatchArray) => string }> = [
  { pattern: /^agent run: '([^']+)'/, format: m => agent(m[1]) },
  { pattern: /^tool: '([^']+)'/, format: m => tool(m[1]) },
  { pattern: /^(?:input|output|input step|output stream|tool result) processor: (.+)$/, format: m => processor(m[1]) },
  { pattern: /^workflow run: '([^']+)'/, format: m => workflow(m[1]) },
  { pattern: /^workflow step: '([^']+)'/, format: m => workflowStep(m[1]) },
  { pattern: /^workspace:([^:]+):(.+)$/, format: m => workspace(m[1], m[2]) },
  { pattern: /^llm: '([^']+)'/, format: m => model(m[1]) },
];

function fromName(name: string): string | undefined {
  for (const { pattern, format } of PATTERNS) {
    const match = name.match(pattern);
    if (match) return format(match);
  }
  return undefined;
}

export function humanizeSpanName(span: HumanizableSpan): string {
  const name = span.name ?? '';
  return fromStructuredFields(span) ?? fromName(name) ?? name ?? '';
}

const SUBJECT_PATTERNS: RegExp[] = [
  /^agent run: '([^']+)'/,
  /^tool: '([^']+)'/,
  /^(?:input|output|input step|output stream|tool result) processor: (.+)$/,
  /^workflow run: '([^']+)'/,
  /^workflow step: '([^']+)'/,
  /^workspace:[^:]+:(.+)$/,
  /^llm: '([^']+)'/,
];

/**
 * The identifier alone — `gpt-5-mini`, `moderation`, `weatherInfo`. The timeline gutter already
 * says what kind of step it is, so repeating "Generated with model" next to `MODEL` is noise.
 * Falls back to the humanized sentence when no identifier can be resolved.
 */
export function spanSubject(span: HumanizableSpan): string {
  const attributes = span.attributes ?? undefined;
  if (span.spanType === 'model_generation' && typeof attributes?.model === 'string') return attributes.model;
  if (span.entityId) return span.entityId;

  const name = span.name ?? '';
  for (const pattern of SUBJECT_PATTERNS) {
    const match = name.match(pattern);
    if (match) return match[1];
  }

  return humanizeSpanName(span);
}
