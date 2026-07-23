import type { WorkflowBuilderDefinition, WorkflowBuilderGraphEntry, WorkflowBuilderSingleStepEntry } from './index';

export type WorkflowDefinitionPreflightIssueCode =
  | 'empty-graph'
  | 'missing-step-id'
  | 'duplicate-step-id'
  | 'missing-reference'
  | 'invalid-nested-workflow-id'
  | 'invalid-map-config'
  | 'invalid-map-reference'
  | 'invalid-map-placement'
  | 'invalid-parallel'
  | 'invalid-foreach'
  | 'invalid-conditional'
  | 'invalid-loop'
  | 'incompatible-schema';

export interface WorkflowDefinitionPreflightIssue {
  code: WorkflowDefinitionPreflightIssueCode;
  path: string;
  message: string;
}

export interface WorkflowDefinitionDependencySchema {
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

export interface WorkflowDefinitionPreflightContext {
  agents?: Record<string, WorkflowDefinitionDependencySchema>;
  tools?: Record<string, WorkflowDefinitionDependencySchema>;
  workflows?: Record<string, WorkflowDefinitionDependencySchema>;
}

export type WorkflowDefinitionPreflightResult =
  { ok: true } | { ok: false; issues: WorkflowDefinitionPreflightIssue[] };

type JsonSchema = Record<string, unknown>;
type SchemaCompatibility = 'compatible' | 'incompatible' | 'unknown';

const agentInputSchema: JsonSchema = {
  type: 'object',
  properties: { prompt: { type: 'string' } },
  required: ['prompt'],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function schemaCompatibility(source: unknown, destination: unknown): SchemaCompatibility {
  if (!isRecord(source) || !isRecord(destination)) return 'unknown';
  const sourceType = typeof source.type === 'string' ? source.type : undefined;
  const destinationType = typeof destination.type === 'string' ? destination.type : undefined;
  if (!sourceType || !destinationType) return 'unknown';
  if (sourceType !== destinationType) return 'incompatible';
  if (destinationType === 'array') return schemaCompatibility(source.items, destination.items);
  if (destinationType !== 'object') return 'compatible';

  const sourceProperties = isRecord(source.properties) ? source.properties : {};
  const destinationProperties = isRecord(destination.properties) ? destination.properties : {};
  const required = Array.isArray(destination.required)
    ? destination.required.filter((key): key is string => typeof key === 'string')
    : [];
  for (const key of required) {
    if (!(key in sourceProperties)) return 'incompatible';
  }
  for (const [key, destinationProperty] of Object.entries(destinationProperties)) {
    if (!(key in sourceProperties)) continue;
    if (schemaCompatibility(sourceProperties[key], destinationProperty) === 'incompatible') return 'incompatible';
  }
  return 'compatible';
}

function schemaAtPath(schema: JsonSchema | undefined, path: string): JsonSchema | undefined {
  if (!schema || path === '' || path === '.') return schema;
  let current: unknown = schema;
  for (const segment of path.split('.')) {
    if (!isRecord(current) || !isRecord(current.properties) || !isRecord(current.properties[segment])) return undefined;
    current = current.properties[segment];
  }
  return current as JsonSchema;
}

function isCanonicalMappingPath(path: string): boolean {
  return path === '' || path === '.' || /^[^.[$\]]+(?:\.[^.[$\]]+)*$/.test(path);
}

function schemaForValue(value: unknown): JsonSchema {
  if (value === null) return { type: 'null' };
  if (Array.isArray(value)) return { type: 'array' };
  switch (typeof value) {
    case 'string':
    case 'boolean':
      return { type: typeof value };
    case 'number':
      return { type: Number.isInteger(value) ? 'integer' : 'number' };
    case 'object':
      return { type: 'object' };
    default:
      return {};
  }
}

function getInputSchema(
  entry: WorkflowBuilderSingleStepEntry,
  context: WorkflowDefinitionPreflightContext,
): JsonSchema | undefined {
  switch (entry.type) {
    case 'agent':
      return context.agents?.[entry.agentId]?.inputSchema ?? agentInputSchema;
    case 'tool':
      return context.tools?.[entry.toolId]?.inputSchema;
    case 'workflow':
      return context.workflows?.[entry.workflowId]?.inputSchema;
    case 'mapping':
      return undefined;
  }
}

function getOutputSchema(
  entry: WorkflowBuilderSingleStepEntry,
  context: WorkflowDefinitionPreflightContext,
): JsonSchema | undefined {
  switch (entry.type) {
    case 'agent':
      return entry.outputSchema ?? context.agents?.[entry.agentId]?.outputSchema;
    case 'tool':
      return context.tools?.[entry.toolId]?.outputSchema;
    case 'workflow':
      return context.workflows?.[entry.workflowId]?.outputSchema;
    case 'mapping':
      return undefined;
  }
}

function validateReference(
  entry: WorkflowBuilderSingleStepEntry,
  path: string,
  issues: WorkflowDefinitionPreflightIssue[],
  context: WorkflowDefinitionPreflightContext,
): void {
  if (entry.type === 'agent' && context.agents && !context.agents[entry.agentId]) {
    issues.push({
      code: 'missing-reference',
      path: `${path}.agentId`,
      message: `Agent "${entry.agentId}" is unavailable.`,
    });
  }
  if (entry.type === 'tool' && context.tools && !context.tools[entry.toolId]) {
    issues.push({
      code: 'missing-reference',
      path: `${path}.toolId`,
      message: `Tool "${entry.toolId}" is unavailable.`,
    });
  }
  if (entry.type === 'workflow') {
    if (entry.id !== entry.workflowId) {
      issues.push({
        code: 'invalid-nested-workflow-id',
        path: `${path}.id`,
        message: `Nested workflow step id "${entry.id}" must match workflowId "${entry.workflowId}". Use "${entry.workflowId}" for both fields.`,
      });
    }
    if (context.workflows && !context.workflows[entry.workflowId]) {
      issues.push({
        code: 'missing-reference',
        path: `${path}.workflowId`,
        message: `Workflow "${entry.workflowId}" is unavailable.`,
      });
    }
  }
}

function validateMapping(
  entry: Extract<WorkflowBuilderSingleStepEntry, { type: 'mapping' }>,
  path: string,
  issues: WorkflowDefinitionPreflightIssue[],
  availableOutputs: ReadonlyMap<string, JsonSchema | undefined>,
  definition: WorkflowBuilderDefinition,
): JsonSchema | undefined {
  let config: unknown;
  try {
    config = JSON.parse(entry.mapConfig);
  } catch {
    issues.push({
      code: 'invalid-map-config',
      path: `${path}.mapConfig`,
      message: 'Mapping config must be a JSON object.',
    });
    return undefined;
  }
  if (!isRecord(config)) {
    issues.push({
      code: 'invalid-map-config',
      path: `${path}.mapConfig`,
      message: 'Mapping config must be a JSON object.',
    });
    return undefined;
  }

  const properties: Record<string, JsonSchema> = {};
  for (const [key, descriptor] of Object.entries(config)) {
    const descriptorPath = `${path}.mapConfig.${key}`;
    if (!isRecord(descriptor)) {
      issues.push({
        code: 'invalid-map-config',
        path: descriptorPath,
        message: 'Mapping descriptor must be an object.',
      });
      continue;
    }
    const forms = [
      'value' in descriptor,
      typeof descriptor.template === 'string',
      typeof descriptor.requestContextPath === 'string',
      'path' in descriptor,
    ].filter(Boolean).length;
    if (forms !== 1) {
      issues.push({
        code: 'invalid-map-config',
        path: descriptorPath,
        message: 'Mapping descriptor must define exactly one source.',
      });
      continue;
    }
    if ('value' in descriptor) {
      properties[key] = schemaForValue(descriptor.value);
      continue;
    }
    if (typeof descriptor.template === 'string') {
      const valid = [...descriptor.template.matchAll(/\$\{([^}]*)\}/g)].every(match => {
        const expression = match[1] ?? '';
        const [scope, ...segments] = expression.split('.');
        if (!expression || expression !== expression.trim()) return false;
        if (scope === 'stepResults') return Boolean(segments[0] && availableOutputs.has(segments[0]));
        if (scope === 'requestContext') return segments.length > 0;
        return typeof scope === 'string' && ['inputData', 'initData', 'state'].includes(scope);
      });
      if (!valid) {
        issues.push({
          code: 'invalid-map-reference',
          path: `${descriptorPath}.template`,
          message: 'Template references must use an available workflow-local source.',
        });
      }
      properties[key] = { type: 'string' };
      continue;
    }
    if (typeof descriptor.requestContextPath === 'string') {
      if (!isCanonicalMappingPath(descriptor.requestContextPath) || descriptor.requestContextPath === '') {
        issues.push({
          code: 'invalid-map-config',
          path: `${descriptorPath}.requestContextPath`,
          message: 'Mapping paths must use plain dotted segments.',
        });
      }
      properties[key] = schemaAtPath(definition.requestContextSchema, descriptor.requestContextPath) ?? {};
      continue;
    }

    if (typeof descriptor.path !== 'string' || !isCanonicalMappingPath(descriptor.path)) {
      issues.push({
        code: 'invalid-map-config',
        path: `${descriptorPath}.path`,
        message: 'Mapping paths must use plain dotted segments.',
      });
      continue;
    }
    const hasInitData = descriptor.initData === true;
    const stepIds =
      typeof descriptor.step === 'string' ? [descriptor.step] : Array.isArray(descriptor.step) ? descriptor.step : [];
    if (hasInitData === stepIds.length > 0 || stepIds.some(stepId => typeof stepId !== 'string')) {
      issues.push({
        code: 'invalid-map-config',
        path: descriptorPath,
        message: 'Path mappings must reference exactly one of initData or step.',
      });
      continue;
    }
    let sourceSchema: JsonSchema | undefined;
    if (hasInitData) {
      sourceSchema = definition.inputSchema;
    } else {
      const missing = stepIds.find(stepId => !availableOutputs.has(stepId));
      if (missing) {
        issues.push({
          code: 'invalid-map-reference',
          path: `${descriptorPath}.step`,
          message: `Mapping source "${missing}" must be a preceding workflow-local step.`,
        });
        continue;
      }
      sourceSchema = stepIds.map(stepId => availableOutputs.get(stepId)).find(Boolean);
    }
    const selectedSchema = schemaAtPath(sourceSchema, descriptor.path);
    if (sourceSchema && !selectedSchema) {
      issues.push({
        code: 'invalid-map-config',
        path: `${descriptorPath}.path`,
        message: `Path "${descriptor.path}" does not exist in the source schema.`,
      });
    }
    properties[key] = selectedSchema ?? {};
  }
  return { type: 'object', properties, required: Object.keys(config) };
}

export function preflightWorkflowDefinition(
  definition: WorkflowBuilderDefinition,
  context: WorkflowDefinitionPreflightContext = {},
): WorkflowDefinitionPreflightResult {
  const issues: WorkflowDefinitionPreflightIssue[] = [];
  if (definition.graph.length === 0)
    issues.push({ code: 'empty-graph', path: 'graph', message: 'Workflow graph must contain at least one step.' });

  const seenIds = new Set<string>();
  const availableOutputs = new Map<string, JsonSchema | undefined>();
  let currentSchema: JsonSchema | undefined = definition.inputSchema;

  const validateSingle = (
    entry: WorkflowBuilderSingleStepEntry,
    path: string,
    container: boolean,
  ): JsonSchema | undefined => {
    if (!entry.id) issues.push({ code: 'missing-step-id', path: `${path}.id`, message: 'Step id is required.' });
    else if (seenIds.has(entry.id))
      issues.push({ code: 'duplicate-step-id', path: `${path}.id`, message: `Step id "${entry.id}" is duplicated.` });
    else seenIds.add(entry.id);

    if (entry.type === 'mapping') {
      if (container) {
        issues.push({
          code: 'invalid-map-placement',
          path,
          message: 'Persisted mapping steps must be top-level workflow entries.',
        });
        return undefined;
      }
      return validateMapping(entry, path, issues, availableOutputs, definition);
    }
    validateReference(entry, path, issues, context);
    const destination = getInputSchema(entry, context);
    if (schemaCompatibility(currentSchema, destination) === 'incompatible') {
      issues.push({
        code: 'incompatible-schema',
        path,
        message: 'Step input is incompatible with the preceding workflow output.',
      });
    }
    return getOutputSchema(entry, context);
  };

  const validateEntry = (entry: WorkflowBuilderGraphEntry, path: string): JsonSchema | undefined => {
    if (entry.type === 'agent' || entry.type === 'tool' || entry.type === 'workflow' || entry.type === 'mapping') {
      return validateSingle(entry, path, false);
    }
    if (entry.type === 'sleep' || entry.type === 'sleepUntil') return currentSchema;
    if (entry.type === 'parallel' || entry.type === 'conditional') {
      if (entry.steps.length === 0) {
        issues.push({
          code: entry.type === 'parallel' ? 'invalid-parallel' : 'invalid-conditional',
          path: `${path}.steps`,
          message: `${entry.type} steps cannot be empty.`,
        });
      }
      if (entry.type === 'conditional' && entry.steps.length !== entry.predicates.length) {
        issues.push({
          code: 'invalid-conditional',
          path,
          message: 'Conditional steps and predicates must be aligned.',
        });
      }
      const properties: Record<string, JsonSchema> = {};
      entry.steps.forEach((child, index) => {
        const output = validateSingle(child, `${path}.steps.${index}`, true);
        if (output) properties[child.id] = output;
      });
      return {
        type: 'object',
        properties,
        ...(entry.type === 'parallel' ? { required: Object.keys(properties) } : {}),
      };
    }
    if (entry.type === 'foreach' || entry.type === 'loop') {
      if (entry.type === 'foreach' && entry.opts?.concurrency !== undefined && entry.opts.concurrency < 1) {
        issues.push({
          code: 'invalid-foreach',
          path: `${path}.opts.concurrency`,
          message: 'Concurrency must be positive.',
        });
      }
      const savedSchema = currentSchema;
      if (entry.type === 'foreach') {
        if (isRecord(currentSchema) && typeof currentSchema.type === 'string' && currentSchema.type !== 'array') {
          issues.push({ code: 'incompatible-schema', path, message: 'Foreach input must be an array.' });
        }
        currentSchema = isRecord(currentSchema?.items) ? (currentSchema.items as JsonSchema) : undefined;
      }
      const output = validateSingle(entry.step, `${path}.step`, true);
      currentSchema = savedSchema;
      if (
        entry.type === 'loop' &&
        schemaCompatibility(output, getInputSchema(entry.step, context)) === 'incompatible'
      ) {
        issues.push({
          code: 'incompatible-schema',
          path: `${path}.step`,
          message: 'Loop step output is incompatible with its input for a subsequent iteration.',
        });
      }
      return entry.type === 'foreach' && output ? { type: 'array', items: output } : output;
    }
    return undefined;
  };

  definition.graph.forEach((entry, index) => {
    currentSchema = validateEntry(entry, `graph.${index}`);
    if ('id' in entry && entry.id) availableOutputs.set(entry.id, currentSchema);
  });
  if (schemaCompatibility(currentSchema, definition.outputSchema) === 'incompatible') {
    issues.push({
      code: 'incompatible-schema',
      path: 'outputSchema',
      message: 'Workflow output schema is incompatible with the final step output.',
    });
  }
  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}
