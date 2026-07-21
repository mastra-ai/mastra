import type { Mastra } from '@mastra/core';
import type { RequestContext } from '@mastra/core/di';
import type { SystemMessage } from '@mastra/core/llm';
import type { StepWithComponent, Workflow, WorkflowInfo } from '@mastra/core/workflows';
import { toStandardSchema, standardSchemaToJSONSchema } from '@mastra/schema-compat/schema';
import type { PublicSchema } from '@mastra/schema-compat/schema';

import { stringify } from 'superjson';
import { MASTRA_RESOURCE_ID_KEY } from './constants';
import { HTTPException } from './http-exception';

/**
 * Convert any PublicSchema to a JSON Schema.
 * Uses toStandardSchema to handle all schema types (Zod v4, AI SDK Schema, JSON Schema).
 */
function schemaToJsonSchema(schema: PublicSchema<unknown> | undefined) {
  if (!schema) return undefined;

  // Convert any PublicSchema to StandardSchemaWithJSON, then extract JSON Schema
  const standardSchema = toStandardSchema(schema);
  return standardSchemaToJSONSchema(standardSchema);
}

/**
 * Normalizes a route path to ensure consistent formatting.
 * - Removes leading/trailing whitespace
 * - Validates no path traversal (..), query strings (?), or fragments (#)
 * - Collapses multiple consecutive slashes
 * - Removes trailing slashes
 * - Ensures leading slash (unless empty)
 *
 * @param path - The route path to normalize
 * @returns The normalized path (empty string for root paths)
 * @throws Error if path contains invalid characters
 */
export function normalizeRoutePath(path: string): string {
  let normalized = path.trim();
  if (normalized.includes('..') || normalized.includes('?') || normalized.includes('#')) {
    throw new Error(`Invalid route path: "${path}". Path cannot contain '..', '?', or '#'`);
  }
  normalized = normalized.replace(/\/+/g, '/');
  if (normalized === '/' || normalized === '') {
    return '';
  }
  if (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  if (!normalized.startsWith('/')) {
    normalized = `/${normalized}`;
  }
  return normalized;
}

const DEFAULT_STORED_RESOURCE_SCOPE_METADATA_KEY = 'mastra.resourceId';

export type StoredResourceScope = {
  metadataKey: string;
  value: string;
};

export type StoredResourceLike = {
  metadata?: Record<string, unknown> | null;
};

export async function getStoredResourceScope(
  mastra: Pick<Mastra, 'getServer'>,
  requestContext: RequestContext | undefined,
): Promise<StoredResourceScope | undefined> {
  const scopeConfig = mastra?.getServer?.()?.storedResources?.scope;
  if (!scopeConfig) {
    return undefined;
  }

  const options = scopeConfig === true ? {} : scopeConfig;
  const metadataKey = options.metadataKey ?? DEFAULT_STORED_RESOURCE_SCOPE_METADATA_KEY;
  const user = requestContext?.get('user');
  const resolved = options.resolve
    ? await options.resolve({ requestContext, user })
    : (requestContext?.get(MASTRA_RESOURCE_ID_KEY) as string | undefined);

  if (!resolved) {
    if (options.requireScope === false) {
      return undefined;
    }
    throw new HTTPException(403, { message: 'Stored resource scope is required' });
  }

  return { metadataKey, value: resolved };
}

export function scopeStoredResourceMetadata(
  metadata: Record<string, unknown> | undefined,
  scope: StoredResourceScope | undefined,
): Record<string, unknown> | undefined {
  if (!scope) {
    return metadata;
  }

  return {
    ...(metadata ?? {}),
    [scope.metadataKey]: scope.value,
  };
}

export function assertStoredResourceScope(
  resource: StoredResourceLike | null | undefined,
  scope: StoredResourceScope | undefined,
): void {
  if (!resource || !scope) {
    return;
  }

  if (resource.metadata?.[scope.metadataKey] !== scope.value) {
    throw new HTTPException(404, { message: 'Stored resource not found' });
  }
}

/**
 * Check if a schema looks like a processor step schema.
 * Processor step schemas are discriminated unions on 'phase' with specific values.
 */
function looksLikeProcessorStepSchema(schema: PublicSchema<unknown> | undefined): boolean {
  if (!schema) return false;

  try {
    const jsonSchema = standardSchemaToJSONSchema(toStandardSchema(schema)) as Record<string, unknown> | undefined;
    if (!jsonSchema) return false;

    // Check for discriminated union pattern: anyOf/oneOf with phase discriminator
    const variants = (jsonSchema.anyOf || jsonSchema.oneOf) as Array<Record<string, unknown>> | undefined;
    if (!variants || !Array.isArray(variants)) return false;

    // Check if all variants have a 'phase' property with processor phase values
    const processorPhases = new Set(['input', 'inputStep', 'outputStream', 'outputResult', 'outputStep']);

    for (const variant of variants) {
      const properties = variant.properties as Record<string, unknown> | undefined;
      if (!properties?.phase) return false;

      const phaseSchema = properties.phase as Record<string, unknown>;
      const phaseConst = phaseSchema?.const as string | undefined;
      const phaseEnum = Array.isArray(phaseSchema?.enum) ? (phaseSchema.enum as string[]) : [];
      const phaseValues = phaseConst ? [phaseConst] : phaseEnum;

      if (!phaseValues.length || phaseValues.some(phase => !processorPhases.has(phase))) {
        return false;
      }
    }

    return variants.length > 0;
  } catch {
    return false;
  }
}

function getSteps(steps: Record<string, StepWithComponent>, path?: string) {
  return Object.entries(steps).reduce<any>((acc, [key, step]) => {
    const fullKey = path ? `${path}.${key}` : key;
    acc[fullKey] = {
      id: step.id,
      description: step.description,
      inputSchema: step.inputSchema ? stringify(schemaToJsonSchema(step.inputSchema)) : undefined,
      outputSchema: step.outputSchema ? stringify(schemaToJsonSchema(step.outputSchema)) : undefined,
      resumeSchema: step.resumeSchema ? stringify(schemaToJsonSchema(step.resumeSchema)) : undefined,
      suspendSchema: step.suspendSchema ? stringify(schemaToJsonSchema(step.suspendSchema)) : undefined,
      stateSchema: step.stateSchema ? stringify(schemaToJsonSchema(step.stateSchema)) : undefined,
      isWorkflow: step.component === 'WORKFLOW',
      component: step.component,
      metadata: step.metadata,
    };

    if (step.component === 'WORKFLOW' && step.steps) {
      const nestedSteps = getSteps(step.steps, fullKey) || {};
      acc = { ...acc, ...nestedSteps };
    }

    return acc;
  }, {});
}

export function getWorkflowInfo(
  workflow: Workflow,
  partial: boolean = false,
  origin?: 'code' | 'stored',
): WorkflowInfo {
  if (partial) {
    // Return minimal info in partial mode
    return {
      name: workflow.name,
      description: workflow.description,
      metadata: workflow.metadata,
      stepCount: Object.keys(workflow.steps).length,
      stepGraph: workflow.serializedStepGraph,
      options: workflow.options,
      steps: {},
      allSteps: {},
      inputSchema: undefined,
      outputSchema: undefined,
      stateSchema: undefined,
      requestContextSchema: undefined,
      origin,
    } as WorkflowInfo;
  }

  return {
    name: workflow.name,
    description: workflow.description,
    metadata: workflow.metadata,
    origin,
    steps: Object.entries(workflow.steps).reduce<any>((acc, [key, step]) => {
      acc[key] = {
        id: step.id,
        description: step.description,
        inputSchema: step.inputSchema ? stringify(schemaToJsonSchema(step.inputSchema)) : undefined,
        outputSchema: step.outputSchema ? stringify(schemaToJsonSchema(step.outputSchema)) : undefined,
        resumeSchema: step.resumeSchema ? stringify(schemaToJsonSchema(step.resumeSchema)) : undefined,
        suspendSchema: step.suspendSchema ? stringify(schemaToJsonSchema(step.suspendSchema)) : undefined,
        stateSchema: step.stateSchema ? stringify(schemaToJsonSchema(step.stateSchema)) : undefined,
        requestContextSchema: step.requestContextSchema
          ? stringify(schemaToJsonSchema(step.requestContextSchema))
          : undefined,
        component: step.component,
        metadata: step.metadata,
      };
      return acc;
    }, {}),
    allSteps: getSteps(workflow.steps) || {},
    stepGraph: workflow.serializedStepGraph,
    inputSchema: workflow.inputSchema ? stringify(schemaToJsonSchema(workflow.inputSchema)) : undefined,
    outputSchema: workflow.outputSchema ? stringify(schemaToJsonSchema(workflow.outputSchema)) : undefined,
    stateSchema: workflow.stateSchema ? stringify(schemaToJsonSchema(workflow.stateSchema)) : undefined,
    requestContextSchema: workflow.requestContextSchema
      ? stringify(schemaToJsonSchema(workflow.requestContextSchema))
      : undefined,
    options: workflow.options,
    isProcessorWorkflow: workflow.type === 'processor' || looksLikeProcessorStepSchema(workflow.inputSchema),
  };
}

/**
 * Workflow Registry for temporarily registering additional workflows
 * that are not part of the user's Mastra instance (e.g., internal template workflows)
 */
export class WorkflowRegistry {
  private static additionalWorkflows: Record<string, Workflow> = {};

  /**
   * Register a workflow temporarily
   */
  static registerTemporaryWorkflow(id: string, workflow: Workflow): void {
    this.additionalWorkflows[id] = workflow;
  }

  /**
   * Register all workflows from map
   */
  static registerTemporaryWorkflows(
    workflows: Record<string, Workflow>,
    mastra?: Mastra<any, any, any, any, any, any, any, any, any>,
  ): void {
    for (const [id, workflow] of Object.entries(workflows)) {
      // Register Mastra instance with the workflow if provided
      if (mastra) {
        workflow.__registerMastra(mastra);
        workflow.__registerPrimitives({
          logger: mastra.getLogger(),
          storage: mastra.getStorage(),
          agents: mastra.listAgents(),
          tts: mastra.getTTS(),
          vectors: mastra.listVectors(),
        });
      }
      this.additionalWorkflows[id] = workflow;
    }
  }

  /**
   * Get a workflow by ID from the registry (returns undefined if not found)
   */
  static getWorkflow(workflowId: string): Workflow | undefined {
    return this.additionalWorkflows[workflowId];
  }

  /**
   * Get all workflows from the registry
   */
  static getAllWorkflows(): Record<string, Workflow> {
    return { ...this.additionalWorkflows };
  }

  /**
   * Clean up a temporary workflow
   */
  static cleanupTemporaryWorkflow(workflowId: string): void {
    delete this.additionalWorkflows[workflowId];
  }
  /**
   * Clean up all registered workflows
   */
  static cleanup(): void {
    // Clear all workflows (since we register all agent-builder workflows each time)
    this.additionalWorkflows = {};
  }

  /**
   * Check if a workflow ID is a valid agent-builder workflow
   */
  static isAgentBuilderWorkflow(workflowId: string): boolean {
    return workflowId in this.additionalWorkflows;
  }

  /**
   * Get all registered temporary workflow IDs (for debugging)
   */
  static getRegisteredWorkflowIds(): string[] {
    return Object.keys(this.additionalWorkflows);
  }
}

/**
 * Converts a string to a URL-friendly slug.
 * Lowercases, replaces non-alphanumeric characters with hyphens,
 * collapses consecutive hyphens, and trims leading/trailing hyphens.
 */
export function toSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function convertInstructionsToString(message: SystemMessage): string {
  if (!message) {
    return '';
  }

  if (typeof message === 'string') {
    return message;
  }

  if (Array.isArray(message)) {
    return message
      .map(m => {
        if (typeof m === 'string') {
          return m;
        }
        // Safely extract content from message objects
        return typeof m.content === 'string' ? m.content : '';
      })
      .filter(content => content) // Remove empty strings
      .join('\n');
  }

  // Handle single message object - safely extract content
  return typeof message.content === 'string' ? message.content : '';
}
