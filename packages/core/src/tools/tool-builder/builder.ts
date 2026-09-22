import { jsonSchema } from '@internal/ai-v6';
import type { Schema } from '@internal/ai-v6';
import type { ProviderDefinedTool, ToolExecutionOptions } from '@internal/external-types';
import {
  OpenAIReasoningSchemaCompatLayer,
  OpenAISchemaCompatLayer,
  GoogleSchemaCompatLayer,
  AnthropicSchemaCompatLayer,
  DeepSeekSchemaCompatLayer,
  MetaSchemaCompatLayer,
  applyCompatLayer,
  convertZodSchemaToAISDKSchema,
} from '@mastra/schema-compat';
import type { SchemaCompatLayer } from '@mastra/schema-compat';
import type { JSONSchema7Definition } from 'json-schema';
import { z } from 'zod/v4';
import {
  getAgentToolFGAResourceId,
  getMCPToolFGAResourceId,
  getStandaloneToolFGAResourceId,
  MastraFGAPermissions,
} from '../../auth/ee';
import { bindBuiltToolFGAResourceId } from '../../auth/ee/fga-check';
import {
  backgroundOverrideJsonSchema,
  backgroundOverrideZodSchema,
  isToolBackgroundEligible,
} from '../../background-tasks';
import { MastraBase } from '../../base';
import { ErrorCategory, MastraError, ErrorDomain } from '../../error';
import type { Mastra } from '../../mastra';
import { SpanType, wrapMastra, EntityType, getOrCreateSpan, createObservabilityContext } from '../../observability';
import type { AnySpan } from '../../observability';
import { executeWithContext } from '../../observability/utils';
import { isInfrastructureRequestContextKey, RequestContext } from '../../request-context';
import { isStandardSchemaWithJSON, toStandardSchema, standardSchemaToJSONSchema } from '../../schema';
import type { StandardSchemaWithJSON } from '../../schema';
import { getNeedsApprovalFn, isVercelTool, isProviderDefinedTool } from '../../tools/toolchecks';
import type { ToolOptions } from '../../utils';
import { isZodObject, safeExtendZodObject } from '../../utils/zod-utils';

import type { SuspendOptions } from '../../workflows';
import { markBuilderValidatedInput, markBuilderValidatedSuspend } from '../builder-validation-context';
import { createToolObserve } from '../observe';
import {
  createToolRecoveryFingerprint as hashToolRecoveryFingerprint,
  defineLazyToolRecoveryFingerprint,
  normalizeToolRecoverySchema,
  normalizeToolRecoverySchemaIdentity,
} from '../recovery-fingerprint';
import { ToolStream } from '../stream';
import { inheritProcessorLoadedToolSource } from '../tool-provenance';
import type {
  CoreTool,
  McpMetadata,
  MastraToolInvocationOptions,
  NeedsApprovalFn,
  ToolAction,
  VercelTool,
  VercelToolV5,
} from '../types';
import {
  isToolValidationError,
  ToolSchemaValidationError,
  validateToolInput,
  validateToolInputAsync,
  validateToolOutput,
  validateToolSuspendData,
} from '../validation';

/**
 * Types that can be converted to Mastra tools.
 * Includes provider-defined tools from external packages via ProviderDefinedTool.
 */
export type ToolToConvert = VercelTool | ToolAction<any, any, any> | VercelToolV5 | ProviderDefinedTool;
export type LogType = 'tool' | 'toolset' | 'client-tool';

const schemasWithoutNativeInputValidation = new WeakSet<object>();

function resolveNativeInputValidationSchema(schema: unknown): StandardSchemaWithJSON | undefined {
  if ((typeof schema === 'object' && schema !== null) || typeof schema === 'function') {
    if (schemasWithoutNativeInputValidation.has(schema)) return undefined;
  }
  if (isStandardSchemaWithJSON(schema)) {
    if (schema['~standard'].vendor === 'ai-sdk') {
      const getSchema = (schema as { getSchema?: unknown }).getSchema;
      if (typeof getSchema === 'function') {
        const wrappedSchema = (schema as unknown as { getSchema: () => Schema }).getSchema();
        if (typeof (wrappedSchema as { validate?: unknown }).validate !== 'function') return undefined;
      }
    }
    return schema;
  }
  if (
    schema &&
    typeof schema === 'object' &&
    typeof (schema as { validate?: unknown }).validate === 'function' &&
    typeof (schema as { jsonSchema?: unknown }).jsonSchema === 'object'
  ) {
    return toStandardSchema(schema as any);
  }
  return undefined;
}

function resolveApprovalInputEditing(
  nativeInputValidationSchema: StandardSchemaWithJSON | undefined,
): 'object' | undefined {
  if (!nativeInputValidationSchema) return undefined;
  return standardSchemaToJSONSchema(nativeInputValidationSchema, { io: 'input' }).type === 'object'
    ? 'object'
    : undefined;
}

function serializeResumeSchema(schema: unknown): string | undefined {
  if (!schema) return undefined;
  try {
    return JSON.stringify(standardSchemaToJSONSchema(toStandardSchema(schema), { io: 'input' }));
  } catch {
    throw new ToolSchemaValidationError();
  }
}

interface LogOptions {
  agentName?: string;
  toolName: string;
  type?: 'tool' | 'toolset' | 'client-tool';
}

interface LogMessageOptions {
  start: string;
  error: string;
  logData: Record<string, unknown>;
}

function createToolRecoveryFingerprint(
  tool: ToolToConvert,
  schemas: { input?: unknown; output?: unknown; suspend?: unknown; resume?: unknown },
  options: { backgroundConfig?: unknown; requireApproval?: unknown },
): string {
  const candidate = tool as unknown as Record<string, unknown>;
  const originalFingerprint =
    typeof candidate.recoveryFingerprint === 'string' ? candidate.recoveryFingerprint : undefined;
  const convertedSchemas = {
    input: normalizeToolRecoverySchema(schemas.input),
    output: normalizeToolRecoverySchema(schemas.output),
    suspend: normalizeToolRecoverySchema(schemas.suspend),
    resume: normalizeToolRecoverySchema(schemas.resume),
  };

  if (originalFingerprint !== undefined) {
    // A Tool fingerprint already binds its runtime schemas, implementation,
    // hooks, and policies. Treat an explicitly assigned fingerprint as the
    // caller's durable version contract instead of re-hashing function source
    // after a second build transform (which can differ across replicas).
    return hashToolRecoveryFingerprint({
      id: candidate.id,
      name: candidate.name,
      type: candidate.type,
      args: candidate.args,
      originalFingerprint,
      description: candidate.description,
      schemas: convertedSchemas,
      builderRequireApproval: options.requireApproval,
      backgroundConfig: options.backgroundConfig,
    });
  }

  return hashToolRecoveryFingerprint({
    id: candidate.id,
    name: candidate.name,
    type: candidate.type,
    args: candidate.args,
    description: candidate.description,
    schemas: convertedSchemas,
    originalSchemaIdentity: normalizeToolRecoverySchemaIdentity(
      candidate.inputSchema ?? candidate.parameters ?? candidate.schema,
    ),
    requestContextSchema: normalizeToolRecoverySchemaIdentity(candidate.requestContextSchema),
    execute: candidate.execute,
    requireApproval: candidate.requireApproval,
    builderRequireApproval: options.requireApproval,
    needsApproval: candidate.needsApproval,
    needsApprovalFn: candidate.needsApprovalFn,
    strict: candidate.strict,
    providerOptions: candidate.providerOptions,
    toModelOutput: candidate.toModelOutput,
    transform: candidate.transform,
    inputExamples: candidate.inputExamples,
    mcp: candidate.mcp,
    mcpMetadata: candidate.mcpMetadata,
    background: candidate.background,
    backgroundConfig: options.backgroundConfig,
    terminalResult: candidate.terminalResult,
    onInputStart: candidate.onInputStart,
    onInputDelta: candidate.onInputDelta,
    onInputAvailable: candidate.onInputAvailable,
    onOutput: candidate.onOutput,
  });
}

function resolveToolFGAResourceId(tool: ToolToConvert, options: ToolOptions): string {
  const mcpMeta =
    !isVercelTool(tool) && 'mcpMetadata' in tool ? (tool as { mcpMetadata?: McpMetadata }).mcpMetadata : undefined;
  return mcpMeta?.serverName
    ? getMCPToolFGAResourceId(mcpMeta.serverName, options.name)
    : options.agentId
      ? getAgentToolFGAResourceId(options.agentId, options.name)
      : getStandaloneToolFGAResourceId(options.name);
}

function cloneInvocationOptionsWithRequestContext(
  execOptions: MastraToolInvocationOptions,
  requestContext: RequestContext | undefined,
): MastraToolInvocationOptions {
  // Preserve accessors without evaluating them. MCP intentionally exposes
  // deprecated top-level context fields as throwing getters, so object spread
  // would fail before the tool can use the canonical nested `mcp` context.
  const invocationOptions: MastraToolInvocationOptions = Object.create(
    Object.getPrototypeOf(execOptions),
    Object.getOwnPropertyDescriptors(execOptions),
  );
  Object.defineProperty(invocationOptions, 'requestContext', {
    configurable: true,
    enumerable: true,
    value: requestContext,
    writable: true,
  });
  return invocationOptions;
}

/**
 * Detect Zod v4 schemas. Zod v3 stores the type name as `_def.typeName`
 * (e.g. "ZodObject"); Zod v4 stores it as `_def.type` (e.g. "object"). We
 * cannot use `instanceof` here because both Zod versions may be loaded in the
 * same process and the prototype identity is not guaranteed.
 */
function isZodV4Schema(schema: unknown): boolean {
  const def = (schema as any)?._def;
  return !!def && typeof def.type === 'string' && !def.typeName;
}

/**
 * Build a Standard Schema that:
 *  - exposes the spliced JSON Schema (with `_background`/`suspendedToolCallId`/
 *    `suspendedToolRunId`/`resumeData` properties added) so provider compat layers see the override
 *    fields when serializing the tool to an LLM, and
 *  - delegates runtime `validate` to the *original* schema so Zod v3
 *    `.transform()` / `.default()` / `.refine()` and other Standard Schema
 *    parsing behavior still run before `execute()` sees the args.
 *
 * Injected override keys (`_background`, `suspendedToolCallId`, `suspendedToolRunId`, `resumeData`)
 * are stripped from the input before delegating, then merged back into the
 * validated value so the inner `execute()` still receives them — matching the
 * Zod v4 `.extend()` path's behavior.
 *
 * If the original schema has no `~standard.validate` (e.g. a raw JSON Schema
 * with no Standard Schema wrapper), fall back to validating against the
 * spliced JSON Schema directly.
 */
function buildJsonOverrideSchema(
  originalSchema: unknown,
  splicedJsonSchema: JSONSchema7Definition,
  injectedKeys: readonly string[],
): StandardSchemaWithJSON {
  const nativeInputValidationSchema = resolveNativeInputValidationSchema(originalSchema);
  const hasOriginalNativeInputValidation = nativeInputValidationSchema !== undefined;
  const fallback = toStandardSchema(splicedJsonSchema as any);
  const original = originalSchema as { '~standard'?: { validate?: (v: unknown) => any } } | undefined;
  const canUseOriginalNativeInputValidation =
    !isStandardSchemaWithJSON(originalSchema) ||
    (((typeof originalSchema === 'object' && originalSchema !== null) || typeof originalSchema === 'function') &&
      schemasWithoutNativeInputValidation.has(originalSchema));
  const originalValidate =
    nativeInputValidationSchema?.['~standard']?.validate?.bind(nativeInputValidationSchema['~standard']) ??
    (canUseOriginalNativeInputValidation ? original?.['~standard']?.validate?.bind(original['~standard']) : undefined);

  // Standard Schema for *just* the injected override fields, so we can validate
  // malformed override payloads (e.g. `_background: { enabled: "yes" }`) before
  // merging them into the result. Matches the Zod v4 `.extend()` path's
  // behavior, which validates these fields as part of the object.
  // See https://github.com/mastra-ai/mastra/pull/16915#discussion_r3282600679
  const splicedProperties =
    splicedJsonSchema && typeof splicedJsonSchema === 'object' && 'properties' in splicedJsonSchema
      ? ((splicedJsonSchema.properties ?? {}) as Record<string, JSONSchema7Definition>)
      : {};
  const injectedProperties: Record<string, JSONSchema7Definition> = {};
  for (const key of injectedKeys) {
    if (splicedProperties[key] !== undefined) injectedProperties[key] = splicedProperties[key];
  }
  const injectedValidator = toStandardSchema({
    type: 'object',
    properties: injectedProperties,
    additionalProperties: false,
  } as any);

  const stripInjected = (input: unknown) => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return { stripped: input, injected: {} };
    const injected: Record<string, unknown> = {};
    const stripped: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (injectedKeys.includes(k)) injected[k] = v;
      else stripped[k] = v;
    }
    return { stripped, injected };
  };

  const validate = (input: unknown) => {
    const { stripped, injected } = stripInjected(input);

    const baseResult = originalValidate
      ? (originalValidate(stripped) as
          | { value: unknown }
          | { issues: readonly unknown[] }
          | Promise<{ value: unknown } | { issues: readonly unknown[] }>)
      : fallback['~standard'].validate(stripped);

    const injectedResult = injectedValidator['~standard'].validate(injected);

    const combine = (
      base: { value: unknown } | { issues: readonly unknown[] },
      inj: { value: unknown } | { issues: readonly unknown[] },
    ) => {
      const baseIssues = 'issues' in base ? (base.issues ?? []) : [];
      const injIssues = 'issues' in inj ? (inj.issues ?? []) : [];
      if (baseIssues.length || injIssues.length) {
        return { issues: [...baseIssues, ...injIssues] };
      }
      const baseValue = (base as { value: unknown }).value;
      const injValue = (inj as { value: unknown }).value;
      if (baseValue && typeof baseValue === 'object' && !Array.isArray(baseValue)) {
        const injMerged =
          injValue && typeof injValue === 'object' && !Array.isArray(injValue)
            ? (injValue as Record<string, unknown>)
            : injected;
        return { value: { ...(baseValue as Record<string, unknown>), ...injMerged } };
      }
      return base;
    };

    const baseIsPromise = baseResult && typeof (baseResult as Promise<unknown>).then === 'function';
    const injIsPromise = injectedResult && typeof (injectedResult as Promise<unknown>).then === 'function';
    if (baseIsPromise || injIsPromise) {
      return Promise.all([baseResult, injectedResult]).then(([b, i]) =>
        combine(
          b as { value: unknown } | { issues: readonly unknown[] },
          i as { value: unknown } | { issues: readonly unknown[] },
        ),
      );
    }
    return combine(
      baseResult as { value: unknown } | { issues: readonly unknown[] },
      injectedResult as { value: unknown } | { issues: readonly unknown[] },
    );
  };

  const augmentedSchema = {
    '~standard': {
      version: 1,
      vendor: 'mastra-json-override',
      validate,
      jsonSchema: fallback['~standard'].jsonSchema,
    },
  } as StandardSchemaWithJSON;

  if (!hasOriginalNativeInputValidation) {
    schemasWithoutNativeInputValidation.add(augmentedSchema);
  }

  return augmentedSchema;
}

export class CoreToolBuilder extends MastraBase {
  private originalTool: ToolToConvert;
  private options: ToolOptions;
  private logType?: LogType;

  private bindFGAResourceId<T extends object>(tool: T): T {
    return bindBuiltToolFGAResourceId(
      tool,
      resolveToolFGAResourceId(this.originalTool, this.options),
      () => (this.options.mastra as any)?.getServer?.()?.fga,
    );
  }

  constructor(input: {
    originalTool: ToolToConvert;
    options: ToolOptions;
    logType?: LogType;
    autoResumeSuspendedTools?: boolean;
    backgroundTaskEnabled?: boolean;
  }) {
    super({ name: 'CoreToolBuilder' });
    this.originalTool = input.originalTool;
    this.options = input.options;
    this.logType = input.logType;

    // Only inject the `_background` override schema for tools that are actually
    // eligible for background execution: the manager must be enabled AND this
    // specific tool must be opted in at the agent or tool layer (the same
    // resolution `resolveBackgroundConfig` uses at dispatch time). Otherwise
    // every user tool's schema would advertise `_background` even though the
    // runtime would never honor it (issue #22724), and mutating every schema
    // with a v4 Zod field breaks v3-authored tools (keyValidator._parse
    // crashes in schema-compat validation).
    const isBackgroundEligible =
      !!input.backgroundTaskEnabled &&
      isToolBackgroundEligible({
        toolName: this.options.name,
        toolConfig: this.options.backgroundConfig,
        agentConfig: this.options.agentBackgroundConfig,
      });
    const isResumableTool =
      input.autoResumeSuspendedTools ||
      (this.originalTool as unknown as ToolAction<any, any>).id?.startsWith('agent-') ||
      (this.originalTool as unknown as ToolAction<any, any>).id?.startsWith('workflow-');

    if (!isVercelTool(this.originalTool) && !isProviderDefinedTool(this.originalTool)) {
      if (isBackgroundEligible || isResumableTool) {
        let schema = this.originalTool.inputSchema;
        if (typeof schema === 'function') {
          schema = schema();
        }
        if (!schema) {
          schema = z.object({});
        }
        // Preferred path: when the user's input schema is a Zod v4 ZodObject
        // (the common case for tools authored with `zod` / `zod/v4`), keep using
        // `.extend()`. This preserves the exact JSON Schema shape that existing
        // provider compat layers + LLM recordings expect.
        //
        // Fallback path: for everything else (Zod v3 ZodObject, raw JSON Schema,
        // `JsonSchemaWrapper`, etc.) splice the override fields directly into a
        // JSON Schema. Mixing a Zod v4 wrapper (`backgroundOverrideZodSchema`,
        // `.nullable()`, `.optional()`) into a Zod v3 ZodObject's `.shape` is
        // what triggered the original crash:
        //   `TypeError: keyValidator._parse is not a function`.
        if (isZodObject(schema) && isZodV4Schema(schema)) {
          let nextSchema: z.ZodObject<any> = schema as z.ZodObject<any>;
          if (isBackgroundEligible) {
            nextSchema = safeExtendZodObject(nextSchema, {
              _background: backgroundOverrideZodSchema,
            });
          }
          if (isResumableTool) {
            nextSchema = safeExtendZodObject(nextSchema, {
              suspendedToolCallId: z.string().describe('The original toolCallId of the suspended tool').optional(),
              suspendedToolRunId: z.string().describe('The runId of the suspended tool').nullable().optional(),
              resumeData: z
                .any()
                .describe('The resumeData object created from the resumeSchema of suspended tool')
                .optional(),
            });
          }
          this.originalTool.inputSchema = toStandardSchema(nextSchema);
        } else {
          // Normalize to Standard Schema, extract JSON Schema, splice overrides.
          const standardSchema = isStandardSchemaWithJSON(schema) ? schema : toStandardSchema(schema);
          const jsonSchema = standardSchemaToJSONSchema(standardSchema, { io: 'input' });

          if (jsonSchema && typeof jsonSchema === 'object' && jsonSchema.type === 'object') {
            const properties: Record<string, JSONSchema7Definition> = { ...(jsonSchema.properties ?? {}) };
            const injectedKeys: string[] = [];

            if (isBackgroundEligible) {
              properties._background = backgroundOverrideJsonSchema;
              injectedKeys.push('_background');
            }
            if (isResumableTool) {
              // Match the pre-PR JSON Schema shape so existing provider compat
              // layers + LLM recordings collapse it identically.
              properties.suspendedToolRunId = {
                type: ['string', 'null'],
                description: 'The runId of the suspended tool',
              };
              properties.suspendedToolCallId = {
                type: 'string',
                description: 'The original toolCallId of the suspended tool',
              };
              properties.resumeData = {
                description: 'The resumeData object created from the resumeSchema of suspended tool',
              };
              injectedKeys.push('suspendedToolCallId', 'suspendedToolRunId', 'resumeData');
            }

            // Preserve the original schema's runtime validator (Zod v3
            // `.transform()` / `.default()` / `.refine()` etc.) while exposing
            // the spliced JSON Schema for provider serialization. See
            // https://github.com/mastra-ai/mastra/pull/16915#discussion_r3282520408
            this.originalTool.inputSchema = buildJsonOverrideSchema(
              schema,
              { ...jsonSchema, properties },
              injectedKeys,
            );
          }
        }
      }
    }
  }

  // Helper to get parameters based on tool type
  private getParameters = () => {
    if (isVercelTool(this.originalTool)) {
      // Handle both 'parameters' (v4) and 'inputSchema' (v5) properties
      // Also handle case where the schema is a function that returns a schema
      let schema =
        this.originalTool.parameters ??
        ('inputSchema' in this.originalTool ? (this.originalTool as any).inputSchema : undefined) ??
        z.object({});

      // If schema is a function, call it to get the actual schema
      if (typeof schema === 'function') {
        schema = schema();
      }

      return schema;
    }

    // For Mastra tools, inputSchema might also be a function
    let schema = this.originalTool.inputSchema;

    if (isStandardSchemaWithJSON(schema)) {
      return schema;
    }

    // If schema is a function, call it to get the actual schema
    if (typeof schema === 'function') {
      schema = schema();
    }

    return schema;
  };

  /** Compat-layer validation schema for execute-time checks (when a layer applies). */
  private buildCompatValidationSchema(
    originalSchema: unknown,
    schemaCompatLayers: SchemaCompatLayer[],
  ): StandardSchemaWithJSON | undefined {
    if (!originalSchema) {
      return undefined;
    }

    let schema = originalSchema;
    if (typeof schema === 'function') {
      schema = schema();
    }

    if (!isStandardSchemaWithJSON(schema)) {
      return undefined;
    }

    const applicableLayer = schemaCompatLayers.find(layer => layer.shouldApply());
    if (!applicableLayer) {
      return undefined;
    }

    return applicableLayer.processToCompatSchema(schema as any);
  }

  private getOutputSchema = () => {
    if ('outputSchema' in this.originalTool) {
      let schema = this.originalTool.outputSchema;

      if (isStandardSchemaWithJSON(schema)) {
        return schema;
      }

      // If schema is a function, call it to get the actual schema
      if (typeof schema === 'function') {
        schema = schema();
      }

      return schema;
    }

    return null;
  };

  private getResumeSchema = () => {
    if ('resumeSchema' in this.originalTool) {
      let schema = this.originalTool.resumeSchema;

      // If schema is a function, call it to get the actual schema
      if (typeof schema === 'function') {
        schema = schema();
      }

      return schema;
    }
    return null;
  };

  private getSuspendSchema = () => {
    if ('suspendSchema' in this.originalTool) {
      let schema = this.originalTool.suspendSchema;

      // If schema is a function, call it to get the actual schema
      if (typeof schema === 'function') {
        schema = schema();
      }

      return schema;
    }
    return null;
  };

  // For provider-defined tools, we need to include all required properties
  // AI SDK v5 uses type: 'provider-defined', AI SDK v6 uses type: 'provider'
  private buildProviderTool(tool: ToolToConvert): (CoreTool & { id: `${string}.${string}` }) | undefined {
    if (
      'type' in tool &&
      (tool.type === 'provider-defined' || tool.type === 'provider') &&
      'id' in tool &&
      typeof tool.id === 'string' &&
      tool.id.includes('.')
    ) {
      // Get schema directly from provider-defined tool (v4 uses parameters, v5 uses inputSchema)
      let parameters: unknown =
        'parameters' in tool ? tool.parameters : 'inputSchema' in tool ? (tool as any).inputSchema : undefined;

      // If schema is a function, call it to get the actual schema
      if (typeof parameters === 'function') {
        parameters = parameters();
      }

      // Get output schema directly from provider-defined tool
      let outputSchema: unknown = 'outputSchema' in tool ? (tool as any).outputSchema : undefined;

      // If schema is a function, call it to get the actual schema
      if (typeof outputSchema === 'function') {
        outputSchema = outputSchema();
      }

      // Convert parameters to AI SDK Schema format
      let processedParameters;
      if (parameters !== undefined && parameters !== null) {
        if (typeof parameters === 'object' && 'jsonSchema' in parameters) {
          // Already in AI SDK Schema format
          processedParameters = parameters;
        } else if (isStandardSchemaWithJSON(parameters)) {
          // StandardSchemaWithJSON - extract the JSON schema and wrap it
          // Use input since parameters represent tool input
          const jsonSchema = standardSchemaToJSONSchema(parameters, { io: 'input' });
          processedParameters = { jsonSchema };
        } else {
          // Assume Zod schema - convert to AI SDK Schema
          processedParameters = convertZodSchemaToAISDKSchema(parameters as any);
        }
      } else {
        // No schema provided - create default empty object schema for AI SDK v1 compatibility
        // OpenAI requires at minimum type: "object" even for tools without parameters
        processedParameters = {
          jsonSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false,
          },
        };
      }

      // Convert output schema to AI SDK Schema format if present
      let processedOutputSchema;
      if (outputSchema !== undefined && outputSchema !== null) {
        if (typeof outputSchema === 'object' && 'jsonSchema' in outputSchema) {
          // Already in AI SDK Schema format
          processedOutputSchema = outputSchema;
        } else if (isStandardSchemaWithJSON(outputSchema)) {
          // StandardSchemaWithJSON - extract the JSON schema and wrap it
          const jsonSchema = standardSchemaToJSONSchema(outputSchema);
          processedOutputSchema = { jsonSchema };
        } else {
          // Assume Zod schema - convert to AI SDK Schema
          processedOutputSchema = convertZodSchemaToAISDKSchema(outputSchema as any);
        }
      }

      const providerTool = {
        ...(processedOutputSchema ? { outputSchema: processedOutputSchema } : {}),
        type: 'provider-defined' as const,
        id: tool.id as `${string}.${string}`,
        // V5 SDK factories set a hardcoded `name` (e.g. "web_search" for
        // anthropic.web_search_20250305). Preserve it so that when this tool
        // is later used with a V6 provider, the bidirectional toolNameMapping
        // resolves the correct model-facing name instead of the versioned ID.
        ...('name' in tool && typeof tool.name === 'string' ? { name: tool.name } : {}),
        args: ('args' in this.originalTool ? this.originalTool.args : {}) as Record<string, unknown>,
        description: tool.description,
        parameters: processedParameters,
        execute: this.originalTool.execute
          ? this.createExecute(
              this.originalTool,
              { ...this.options, description: this.originalTool.description },
              this.logType,
            )
          : undefined,
        toModelOutput: 'toModelOutput' in this.originalTool ? this.originalTool.toModelOutput : undefined,
        transform: 'transform' in this.originalTool ? this.originalTool.transform : undefined,
        inputExamples: 'inputExamples' in this.originalTool ? this.originalTool.inputExamples : undefined,
      } as unknown as CoreTool & { id: `${string}.${string}` };
      return this.bindFGAResourceId(providerTool);
    }

    return undefined;
  }

  private createLogMessageOptions({ agentName, toolName, type }: LogOptions): LogMessageOptions {
    const toolType = type === 'toolset' ? 'toolset' : 'tool';
    return {
      start: `Executing ${toolType}`,
      error: `Failed ${toolType} execution`,
      logData: { agent: agentName, tool: toolName },
    };
  }

  private createExecute(
    tool: ToolToConvert,
    options: ToolOptions,
    logType?: 'tool' | 'toolset' | 'client-tool',
    inputValidationSchema?: StandardSchemaWithJSON,
  ) {
    // don't add memory, mastra, or tracing context to logging (tracingContext may contain sensitive observability credentials)
    const {
      logger,
      mastra: _mastra,
      memory: _memory,
      requestContext,
      model,
      tracingContext: _tracingContext,
      tracingPolicy: _tracingPolicy,
      ...rest
    } = options;
    const logModelObject = {
      modelId: model?.modelId,
      provider: model?.provider,
      specificationVersion: model?.specificationVersion,
    };

    const { start, logData } = this.createLogMessageOptions({
      agentName: options.agentName,
      toolName: options.name,
      type: logType,
    });

    // Extract MCP metadata once with proper typing to avoid repeated unsafe casts
    const mcpMeta =
      !isVercelTool(tool) && 'mcpMetadata' in tool ? (tool as { mcpMetadata?: McpMetadata }).mcpMetadata : undefined;
    const fgaResourceId = resolveToolFGAResourceId(tool, options);

    const execFunction = async (args: unknown, execOptions: MastraToolInvocationOptions, toolSpan?: AnySpan) => {
      try {
        let result;
        let suspendCalled = false;
        let suspendValidationError: unknown;

        const finishValidationFailure = (kind: 'resume data' | 'suspension data' | 'output', error: unknown) => {
          logger?.warn(`Tool ${kind} validation failed`, logData);
          toolSpan?.end({ output: { error: true }, attributes: { success: false } });
          return error;
        };

        if (isVercelTool(tool)) {
          // Handle Vercel tools (AI SDK tools)
          result = await executeWithContext({
            span: toolSpan,
            fn: async () => tool?.execute?.(args, execOptions as ToolExecutionOptions),
          });
        } else {
          // Handle Mastra tools - wrap mastra instance with tracing context for context propagation

          /**
           * MASTRA INSTANCE TYPES IN TOOL EXECUTION:
           *
           * Full Mastra & MastraPrimitives (has getAgent, getWorkflow, etc.):
           * - Auto-generated workflow tools from agent.listWorkflows()
           * - These get this.#mastra directly and can be wrapped
           *
           * MastraPrimitives only (limited interface):
           * - Memory tools (from memory.listTools())
           * - Assigned tools (agent.tools)
           * - Toolset tools (from toolsets)
           * - Client tools (passed as tools in generate/stream options)
           * - These get mastraProxy and have limited functionality
           *
           * TODO: Consider providing full Mastra instance to more tool types for enhanced functionality
           */
          // Wrap mastra with tracing context - wrapMastra will handle whether it's a full instance or primitives
          const wrappedMastra = options.mastra ? wrapMastra(options.mastra, { currentSpan: toolSpan }) : options.mastra;

          const resumeSchema = this.getResumeSchema();
          const suspendSchema = this.getSuspendSchema();
          // Pass raw args as first parameter, context as second
          // Properly structure context based on execution source
          const baseContext = {
            threadId: options.threadId,
            resourceId: options.resourceId,
            mastra: wrappedMastra,
            memory: options.memory,
            runId: options.runId,
            // [PF-1874] The outer wrapper already computed the authoritative
            // per-call context (build entries first, execution application keys
            // override, infrastructure keys stay build-authoritative) and passed
            // it through as `execOptions.requestContext`, so use it directly to
            // preserve both identity and the documented per-call precedence.
            requestContext: execOptions.requestContext ?? options.requestContext ?? new RequestContext(),
            actor: execOptions.actor,
            // Workspace for file operations and command execution
            // Execution-time workspace (from prepareStep/processInputStep) takes precedence over build-time workspace
            workspace: execOptions.workspace ?? options.workspace,
            // Browser for web automation (lazily initialized on first use)
            browser: options.browser,
            observe: execOptions.observe ?? createToolObserve(toolSpan),
            writer: new ToolStream(
              {
                prefix: 'tool',
                callId: execOptions.toolCallId,
                name: options.name,
                runId: options.runId!,
              },
              options.outputWriter || execOptions.outputWriter,
            ),
            ...createObservabilityContext({ currentSpan: toolSpan }),
            abortSignal: execOptions.abortSignal,
            suspend: (args: any, suspendOptions?: SuspendOptions) => {
              suspendCalled = true;
              const validation = validateToolSuspendData(suspendSchema, args, options.name);
              if (validation.error) {
                suspendValidationError = validation.error;
                return Promise.resolve(validation.error) as never;
              }
              const newSuspendOptions = {
                ...(suspendOptions ?? {}),
                resumeSchema: suspendOptions?.resumeSchema ?? serializeResumeSchema(resumeSchema),
              };
              return execOptions.suspend?.(args, newSuspendOptions);
            },
            resumeData: execOptions.resumeData,
          };

          // Check if this is agent execution
          // Agent execution takes precedence over workflow execution because agents may
          // use workflows internally for their agentic loop
          // Note: AI SDK v4 doesn't pass toolCallId/messages, so we also check for agentName and threadId
          const isAgentExecution =
            (execOptions.toolCallId && execOptions.messages) ||
            (options.agentName && options.threadId && !options.workflowId);

          // Check if this is workflow execution (has workflow properties in options)
          // Only consider it workflow execution if it's NOT agent execution
          const isWorkflowExecution = !isAgentExecution && (options.workflow || options.workflowId);

          let toolContext;
          if (isAgentExecution) {
            // Nest agent-specific properties under 'agent' key
            // Do NOT include workflow context even if workflow properties exist
            // (agents use workflows internally but tools should see agent context)
            // Preserve MCP context when the agent run originated from an MCP tools/call
            // so nested tools can use elicitation/log/progress.
            const { suspend, resumeData, threadId, resourceId, ...restBaseContext } = baseContext;
            toolContext = {
              ...restBaseContext,
              ...(execOptions.mcp ? { mcp: execOptions.mcp } : {}),
              agent: {
                agentId: options.agentId || '',
                toolCallId: execOptions.toolCallId || '',
                messages: execOptions.messages || [],
                suspend,
                resumeData,
                threadId,
                resourceId,
                outputWriter: options.outputWriter || execOptions.outputWriter,
                flushMessages: execOptions.flushMessages,
                ...(execOptions.isBackgroundTask ? { isBackgroundTask: true } : {}),
              },
            };
          } else if (isWorkflowExecution) {
            // Nest workflow-specific properties under 'workflow' key
            const { suspend, resumeData, ...restBaseContext } = baseContext;
            toolContext = {
              ...restBaseContext,
              ...(execOptions.mcp ? { mcp: execOptions.mcp } : {}),
              workflow: options.workflow || {
                runId: options.runId,
                workflowId: options.workflowId,
                state: options.state,
                setState: options.setState,
                suspend,
                resumeData,
              },
            };
          } else if (execOptions.mcp) {
            // MCP execution context
            toolContext = {
              ...baseContext,
              mcp: execOptions.mcp,
            };
          } else {
            // Direct execution or unknown context
            toolContext = baseContext;
          }

          result = await executeWithContext({
            span: toolSpan,
            fn: async () => {
              if (inputValidationSchema) {
                markBuilderValidatedInput(toolContext);
              }
              markBuilderValidatedSuspend(toolContext);
              return tool?.execute?.(args, toolContext);
            },
          });
        }

        if (suspendValidationError) {
          return finishValidationFailure('suspension data', suspendValidationError) as any;
        }

        // Skip validation if suspend was called without a result
        const shouldSkipValidation = typeof result === 'undefined' && suspendCalled;
        if (shouldSkipValidation) {
          toolSpan?.end({ output: result, attributes: { success: true } });
          return result;
        }

        // Validate output for Vercel/AI SDK tools which don't have built-in validation
        // Mastra tools handle their own validation in Tool.execute() which properly
        // applies Zod transforms (e.g., .transform(), .pipe()) to the output
        if (isVercelTool(tool)) {
          const outputSchema = this.getOutputSchema();
          const outputValidation = validateToolOutput(outputSchema, result, options.name, false);
          if (outputValidation.error) {
            return finishValidationFailure('output', outputValidation.error);
          }
          result = outputValidation.data;
        }

        if (!isVercelTool(tool) && isToolValidationError(result)) {
          return finishValidationFailure('output', result);
        }

        // Return result (validated for Vercel tools, already validated for Mastra tools)
        toolSpan?.end({ output: result, attributes: { success: true } });
        return result;
      } catch (error) {
        if (error instanceof ToolSchemaValidationError) {
          throw error;
        }
        toolSpan?.error({ error: error as Error, attributes: { success: false } });
        throw error;
      }
    };

    return async (args: unknown, execOptions?: MastraToolInvocationOptions) => {
      let logger = options.logger || this.logger;
      const actor = execOptions?.actor;

      // Create tool span early so validation failures are always observable.
      // Prefer execution-time tracingContext (passed at runtime for VNext methods)
      // Fall back to build-time context for Legacy methods (AI SDK v4 doesn't support passing custom options)
      const tracingContext = execOptions?.tracingContext || options.tracingContext;
      const executionRequestContext = execOptions?.requestContext;
      const toolRequestContext =
        executionRequestContext && options.requestContext && executionRequestContext !== options.requestContext
          ? new RequestContext<unknown>([
              ...Array.from(options.requestContext.entries() as IterableIterator<[string, unknown]>),
              ...Array.from(executionRequestContext.entries() as IterableIterator<[string, unknown]>).filter(
                ([key]) => !isInfrastructureRequestContextKey(key) || !options.requestContext?.has(key),
              ),
            ])
          : (executionRequestContext ?? options.requestContext);
      // The provider tool-call id is the only key that lets exporters join
      // this span with the stream's tool frames and with any observed child
      // spans the tool creates internally; without it every consumer sees the
      // same execution as two or three unlinkable "calls".
      const spanToolCallId =
        typeof execOptions?.toolCallId === 'string' && execOptions.toolCallId.length > 0
          ? { toolCallId: execOptions.toolCallId }
          : {};
      const toolSpan = getOrCreateSpan({
        type: mcpMeta ? SpanType.MCP_TOOL_CALL : SpanType.TOOL_CALL,
        name: mcpMeta ? `mcp_tool: '${options.name}' on '${mcpMeta.serverName}'` : `tool: '${options.name}'`,
        entityType: EntityType.TOOL,
        entityId: options.name,
        entityName: options.name,
        attributes: mcpMeta
          ? {
              mcpServer: mcpMeta.serverName,
              serverVersion: mcpMeta.serverVersion,
              toolType: logType || 'tool',
              toolDescription: options.description,
              ...spanToolCallId,
            }
          : {
              toolDescription: options.description,
              toolType: logType || 'tool',
              ...spanToolCallId,
            },
        tracingPolicy: options.tracingPolicy,
        tracingContext: tracingContext,
        requestContext: toolRequestContext,
        mastra: options.mastra && 'observability' in options.mastra ? (options.mastra as Mastra) : undefined,
      });

      const fgaProvider = (options.mastra as any)?.getServer?.()?.fga;
      const user = toolRequestContext?.get('user');
      if (fgaProvider) {
        const { requireFGA } = await import('../../auth/ee/fga-check');
        await requireFGA({
          fgaProvider,
          user,
          resource: { type: 'tool', id: fgaResourceId },
          permission: MastraFGAPermissions.TOOLS_EXECUTE,
          actor,
          requestContext: toolRequestContext,
          context: {
            resourceId: options.resourceId,
          },
          metadata: {
            toolName: options.name,
            agentId: options.agentId,
            agentName: options.agentName,
            runId: options.runId,
            threadId: options.threadId,
            executionResourceId: options.resourceId,
            mcpMetadata: mcpMeta,
          },
        });
      }

      try {
        logger.debug(start, { ...logData, ...rest, model: logModelObject });

        // When a tool is being resumed (resumeData present in execOptions), validation
        // must not FAIL the call: the original args were already validated during the
        // initial execution, and delegated agent/workflow resumes replay args carrying
        // control fields (e.g. suspendedToolRunId) the schema does not know.
        const isResuming = execOptions?.resumeData !== undefined;

        const parameters = inputValidationSchema ?? this.getParameters();
        if (!isResuming) {
          const { data, error } = await validateToolInputAsync(
            parameters as StandardSchemaWithJSON | undefined,
            args,
            options.name,
          );
          //suspendedToolRunId is only required when resumeData is provided
          const suspendedToolRunIdErrToIgnore =
            error?.message?.includes('suspendedToolRunId: Required') &&
            (args as Record<string, unknown>)?.resumeData === undefined;
          if (error && !suspendedToolRunIdErrToIgnore) {
            logger.warn('Tool input validation failed', logData);
            toolSpan?.end({ output: { error: true }, attributes: { success: false } });
            return error;
          }
          // Use validated/transformed data
          args = data;
        } else {
          // Best-effort normalization on resume: replayed args keep the provider's
          // raw shape (OpenAI strict compat materializes .optional() fields as null),
          // so a tool whose execute re-parses its input with the original zod schema
          // would throw on the resumed leg even though the initial leg passed. Reuse
          // the same normalization pipeline; on validation error keep the raw args so
          // delegated resumes with extra control fields behave exactly as before.
          const { data, error } = await validateToolInputAsync(parameters, args, options.name);
          if (error === undefined) {
            args = data;
          }
        }

        if (isResuming && !isVercelTool(tool)) {
          const resumeValidation = validateToolInput(this.getResumeSchema(), execOptions?.resumeData, options.name);
          if (resumeValidation.error) {
            logger.warn('Tool resume data validation failed', logData);
            toolSpan?.end({ output: { error: true }, attributes: { success: false } });
            return resumeValidation.error;
          }
        }

        // Attach input only after validation so rejected arguments never reach telemetry.
        toolSpan?.update({ input: args });

        // there is a small delay in stream output so we add an immediate to ensure the stream is ready
        return await new Promise((resolve, reject) => {
          setImmediate(async () => {
            try {
              const invocationOptions = cloneInvocationOptionsWithRequestContext(execOptions!, toolRequestContext);
              const result = await execFunction(args, invocationOptions, toolSpan);
              resolve(result);
            } catch (err) {
              reject(err);
            }
          });
        });
      } catch (err) {
        const schemaValidationFailed = err instanceof ToolSchemaValidationError;
        const mastraError = new MastraError(
          {
            id: 'TOOL_EXECUTION_FAILED',
            domain: ErrorDomain.TOOL,
            category: ErrorCategory.USER,
            // Raw args are intentionally omitted: they can carry credentials or PII and
            // are already recorded on the tool span, where observability redaction applies.
            details: {
              errorMessage: schemaValidationFailed ? err.message : String(err),
              model: model?.modelId ?? '',
            },
          },
          err,
        );
        const telemetryError = schemaValidationFailed
          ? new MastraError({
              id: 'TOOL_EXECUTION_FAILED',
              domain: ErrorDomain.TOOL,
              category: ErrorCategory.USER,
              details: {
                errorMessage: 'Tool schema validation failed unexpectedly.',
                model: model?.modelId ?? '',
              },
            })
          : mastraError;
        toolSpan?.error({ error: telemetryError, attributes: { success: false } });
        logger.trackException(telemetryError, { ...logData, ...rest, model: logModelObject });
        throw mastraError;
      }
    };
  }

  buildV5() {
    const builtTool = this.build();

    if (!builtTool.parameters) {
      throw new Error('Tool parameters are required');
    }

    const base = {
      ...builtTool,
      inputSchema: builtTool.parameters,
      onInputStart: 'onInputStart' in this.originalTool ? this.originalTool.onInputStart : undefined,
      onInputDelta: 'onInputDelta' in this.originalTool ? this.originalTool.onInputDelta : undefined,
      onInputAvailable: 'onInputAvailable' in this.originalTool ? this.originalTool.onInputAvailable : undefined,
      onOutput: 'onOutput' in this.originalTool ? this.originalTool.onOutput : undefined,
    };

    // For provider-defined tools, exclude execute and add name as per v5 spec
    if (builtTool.type === 'provider-defined') {
      const { execute, parameters, ...rest } = base;
      // Prefer the preserved provider name (e.g. "web_search" from V5 SDK
      // factories) over the ID-derived name (e.g. "web_search_20250305").
      const name =
        ('name' in builtTool && typeof builtTool.name === 'string' ? builtTool.name : null) ||
        builtTool.id.split('.')[1] ||
        builtTool.id;
      return this.bindFGAResourceId({
        ...rest,
        type: builtTool.type,
        id: builtTool.id,
        name,
        args: builtTool.args,
      } as VercelToolV5);
    }

    return this.bindFGAResourceId(base as VercelToolV5);
  }

  build(): CoreTool {
    const providerTool = this.buildProviderTool(this.originalTool);
    if (providerTool) {
      return inheritProcessorLoadedToolSource(this.originalTool, providerTool);
    }
    const model = this.options.model;

    const schemaCompatLayers = [];

    // `strict: false` opts the tool out of strict structured-output schema rewriting.
    // OpenAI strict mode forces every property into `required` (nullable), which makes it
    // impossible for a model to genuinely omit a field - tools that rely on partial input
    // (e.g. working memory merge updates) need the original optionality preserved.
    const optsOutOfStrictSchemas = 'strict' in this.originalTool && this.originalTool.strict === false;

    if (model && !optsOutOfStrictSchemas) {
      // Respect the model's own capability flag; do not disable it based solely on specificationVersion.
      const supportsStructuredOutputs =
        'supportsStructuredOutputs' in model ? (model.supportsStructuredOutputs ?? false) : false;

      const modelInfo = {
        modelId: model.modelId,
        supportsStructuredOutputs,
        provider: model.provider,
      };

      schemaCompatLayers.push(
        new OpenAIReasoningSchemaCompatLayer(modelInfo),
        new OpenAISchemaCompatLayer(modelInfo),
        new GoogleSchemaCompatLayer(modelInfo),
        new AnthropicSchemaCompatLayer(modelInfo),
        new DeepSeekSchemaCompatLayer(modelInfo),
        new MetaSchemaCompatLayer(modelInfo),
      );
    }

    const originalSchema = this.getParameters();
    // Keep native author validation separate from approval editing eligibility:
    // unions/intersections can carry constraints that are not editable approval
    // objects, but still need native preflight validation before compatibility
    // layers rewrite their JSON Schema.
    const approvalInputValidationSchema = resolveNativeInputValidationSchema(originalSchema);
    const approvalInputEditing = resolveApprovalInputEditing(approvalInputValidationSchema);
    const inputValidationSchema = this.buildCompatValidationSchema(originalSchema, schemaCompatLayers);
    let processedInputSchema: Schema | undefined;

    if (originalSchema) {
      if (isStandardSchemaWithJSON(originalSchema)) {
        // Find the first applicable compatibility layer
        const applicableLayer = schemaCompatLayers.find(layer => layer.shouldApply());

        let schemaToUse: StandardSchemaWithJSON;
        if (applicableLayer) {
          schemaToUse = applicableLayer.processToCompatSchema(originalSchema as any);
        } else {
          schemaToUse = toStandardSchema(originalSchema);
        }

        processedInputSchema = jsonSchema(
          standardSchemaToJSONSchema(schemaToUse, {
            io: 'input',
          }),
          {
            validate: (value: unknown) => {
              const result = schemaToUse['~standard'].validate(value);
              // standard-schema validate may return a Promise
              if (result instanceof Promise) {
                return result.then(r => {
                  if ('issues' in r && r.issues) {
                    return {
                      success: false as const,
                      error: new Error(r.issues.map((i: any) => i.message).join(', ')),
                    };
                  }
                  return { success: true as const, value: (r as { value: unknown }).value };
                });
              }
              // standard-schema returns { value } on success or { issues } on failure,
              // but AI SDK expects { success: boolean, value/error }
              if ('issues' in result && result.issues) {
                return {
                  success: false as const,
                  error: new Error(result.issues.map((i: any) => i.message).join(', ')),
                };
              }
              return { success: true as const, value: (result as { value: unknown }).value };
            },
          },
        );
      } else {
        const compatSchema = applyCompatLayer({
          schema: originalSchema,
          compatLayers: schemaCompatLayers,
          mode: 'aiSdkSchema',
        });
        processedInputSchema = jsonSchema(compatSchema.jsonSchema, { validate: compatSchema.validate });
      }
    }

    const outputSchema = this.getOutputSchema();
    let processedOutputSchema: unknown;

    if (outputSchema) {
      if (isStandardSchemaWithJSON(outputSchema)) {
        processedOutputSchema = standardSchemaToJSONSchema(outputSchema, { io: 'output' });
      } else {
        processedOutputSchema = applyCompatLayer({
          schema: outputSchema,
          compatLayers: [],
          mode: 'aiSdkSchema',
        });
      }
    }

    // Map AI SDK's needsApproval to our requireApproval
    // needsApproval can be boolean or a function that takes input and returns boolean
    let requireApproval = false;
    let needsApprovalFn: NeedsApprovalFn | undefined;

    if (typeof this.options.requireApproval === 'function') {
      requireApproval = true;
      needsApprovalFn = this.options.requireApproval;
    } else if (typeof this.options.requireApproval === 'boolean') {
      requireApproval = this.options.requireApproval;
      needsApprovalFn = undefined;
    }

    if (isVercelTool(this.originalTool) && 'needsApproval' in this.originalTool) {
      const needsApproval = (this.originalTool as any).needsApproval;
      if (typeof needsApproval === 'boolean') {
        requireApproval = needsApproval;
        needsApprovalFn = undefined;
      } else if (typeof needsApproval === 'function') {
        // Store the function to evaluate it per-call
        needsApprovalFn = needsApproval;
        // Set requireApproval to true so the tool-call-step knows to check the function
        requireApproval = true;
      }
    }

    // Preserve a needsApprovalFn that was attached directly to the tool instance
    // (e.g. MCP tools wrap a server-level `requireToolApproval` function and set
    // `needsApprovalFn` on the tool while keeping `requireApproval` as a boolean).
    // The branches above only derive needsApprovalFn from options/AI SDK shapes, so
    // without this it would be dropped during conversion and conditional approval
    // would silently fall back to the boolean flag.
    const instanceNeedsApprovalFn = getNeedsApprovalFn(this.originalTool);
    if (!needsApprovalFn && instanceNeedsApprovalFn) {
      needsApprovalFn = instanceNeedsApprovalFn;
      // Ensure the tool-call-step knows to evaluate the function per call.
      requireApproval = true;
    }

    const definition = {
      type: 'function' as const,
      description: this.originalTool.description,
      requireApproval,
      needsApprovalFn,
      hasSuspendSchema: !!this.getSuspendSchema(),
      // Approval gates run before execute(), so expose the exact runtime
      // validator separately. The agent loop uses this to keep schema-invalid
      // calls out of a user-facing approval queue; execute() still performs
      // authoritative validation immediately before side effects.
      validateInput: (params: unknown) =>
        approvalInputValidationSchema
          ? validateToolInputAsync(approvalInputValidationSchema, params, this.options.name)
          : validateToolInput(inputValidationSchema ?? this.getParameters(), params, this.options.name),
      approvalInputEditing,
      execute: this.originalTool.execute
        ? this.createExecute(
            this.originalTool,
            { ...this.options, description: this.originalTool.description },
            this.logType,
            // Raw AI SDK schemas can carry an async validator even when no
            // compatibility schema is built. Execution must apply that same
            // author validator so defaults/transforms accepted by approval
            // preflight reach the tool implementation.
            inputValidationSchema ?? approvalInputValidationSchema,
          )
        : undefined,
    };

    const builtTool = {
      ...definition,
      id: 'id' in this.originalTool ? this.originalTool.id : undefined,
      parameters: processedInputSchema ?? z.object({}),
      outputSchema: processedOutputSchema,
      strict: 'strict' in this.originalTool ? this.originalTool.strict : undefined,
      providerOptions: 'providerOptions' in this.originalTool ? this.originalTool.providerOptions : undefined,
      mcp: 'mcp' in this.originalTool ? this.originalTool.mcp : undefined,
      toModelOutput: 'toModelOutput' in this.originalTool ? this.originalTool.toModelOutput : undefined,
      transform: 'transform' in this.originalTool ? this.originalTool.transform : undefined,
      inputExamples: 'inputExamples' in this.originalTool ? this.originalTool.inputExamples : undefined,
      onInputStart: 'onInputStart' in this.originalTool ? this.originalTool.onInputStart : undefined,
      onInputDelta: 'onInputDelta' in this.originalTool ? this.originalTool.onInputDelta : undefined,
      onInputAvailable: 'onInputAvailable' in this.originalTool ? this.originalTool.onInputAvailable : undefined,
      onOutput: 'onOutput' in this.originalTool ? this.originalTool.onOutput : undefined,
      // Preserve tool-level background config so the agentic loop can pick it up
      // from the converted CoreTool at dispatch time.
      backgroundConfig: this.options.backgroundConfig,
      terminalResult: 'terminalResult' in this.originalTool ? this.originalTool.terminalResult : undefined,
    } as unknown as CoreTool;
    const recoveryOriginalTool = this.originalTool;
    const recoverySchemas = {
      input: processedInputSchema,
      output: processedOutputSchema,
      suspend: this.getSuspendSchema(),
      resume: this.getResumeSchema(),
    };
    const recoveryOptions = {
      backgroundConfig: this.options.backgroundConfig,
      requireApproval: this.options.requireApproval,
    };
    defineLazyToolRecoveryFingerprint(builtTool, () =>
      createToolRecoveryFingerprint(recoveryOriginalTool, recoverySchemas, recoveryOptions),
    );
    return inheritProcessorLoadedToolSource(this.originalTool, this.bindFGAResourceId(builtTool));
  }
}
