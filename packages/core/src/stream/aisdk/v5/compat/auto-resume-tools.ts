import {
  AnthropicSchemaCompatLayer,
  DeepSeekSchemaCompatLayer,
  GoogleSchemaCompatLayer,
  MetaSchemaCompatLayer,
  OpenAIReasoningSchemaCompatLayer,
  OpenAISchemaCompatLayer,
  applyCompatLayer,
} from '@mastra/schema-compat';
import type { ModelInformation } from '@mastra/schema-compat';
import type { JSONSchema7 } from 'json-schema';
import type { SuspendedToolDescriptor } from '../../../../loop/shared/auto-resume-system-message';

export type { SuspendedToolDescriptor } from '../../../../loop/shared/auto-resume-system-message';

type PreparedFunctionTool = {
  type: 'function';
  name: string;
  inputSchema: Record<string, unknown>;
};

type PreparedTool = {
  type: string;
  name?: string;
  inputSchema?: unknown;
};

function parseResumeSchema(value: unknown): JSONSchema7 | undefined {
  let parsed = value;

  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      return undefined;
    }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return undefined;
  }

  const schema = parsed as JSONSchema7;
  const hasSchemaShape =
    schema.type !== undefined ||
    schema.$ref !== undefined ||
    schema.anyOf !== undefined ||
    schema.oneOf !== undefined ||
    schema.allOf !== undefined ||
    schema.enum !== undefined ||
    schema.const !== undefined;

  return hasSchemaShape ? schema : undefined;
}

function createSchemaCompatLayers(model: ModelInformation) {
  return [
    new OpenAIReasoningSchemaCompatLayer(model),
    new OpenAISchemaCompatLayer(model),
    new GoogleSchemaCompatLayer(model),
    new AnthropicSchemaCompatLayer(model),
    new DeepSeekSchemaCompatLayer(model),
    new MetaSchemaCompatLayer(model),
  ];
}

function rewriteLocalRefs(value: unknown, nestedRoot: string): unknown {
  if (Array.isArray(value)) {
    return value.map(item => rewriteLocalRefs(item, nestedRoot));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => key !== '$schema')
      .map(([key, child]) => {
        if (key === '$ref' && typeof child === 'string') {
          if (child === '#') {
            return [key, nestedRoot];
          }
          if (child.startsWith('#/')) {
            return [key, `${nestedRoot}/${child.slice(2)}`];
          }
        }
        return [key, rewriteLocalRefs(child, nestedRoot)];
      }),
  );
}

function schemasForSuspendedTools({
  suspendedTools,
  model,
}: {
  suspendedTools: ReadonlyArray<SuspendedToolDescriptor>;
  model: ModelInformation;
}) {
  const byToolName = new Map<string, JSONSchema7[]>();
  const compatLayers = createSchemaCompatLayers(model);

  for (const suspendedTool of suspendedTools) {
    if (typeof suspendedTool.toolName !== 'string') continue;

    const resumeSchema = parseResumeSchema(suspendedTool.resumeSchema);
    if (!resumeSchema) continue;

    const compatibleSchema = applyCompatLayer({
      schema: resumeSchema,
      compatLayers,
      mode: 'jsonSchema',
    });
    const existing = byToolName.get(suspendedTool.toolName) ?? [];
    const serialized = JSON.stringify(compatibleSchema);

    if (!existing.some(schema => JSON.stringify(schema) === serialized)) {
      existing.push(compatibleSchema);
    }
    byToolName.set(suspendedTool.toolName, existing);
  }

  return byToolName;
}

function isPreparedFunctionTool(tool: PreparedTool): tool is PreparedFunctionTool {
  return (
    tool.type === 'function' &&
    typeof tool.name === 'string' &&
    !!tool.inputSchema &&
    typeof tool.inputSchema === 'object' &&
    !Array.isArray(tool.inputSchema)
  );
}

/**
 * Add automatic-resume controls to the provider-facing schema for the suspended
 * tool only. The canonical tool schema remains untouched on ordinary turns.
 */
export function injectAutoResumeToolSchemas<T extends PreparedTool>({
  tools,
  suspendedTools,
  model,
}: {
  tools: T[] | undefined;
  suspendedTools: ReadonlyArray<SuspendedToolDescriptor> | undefined;
  model: ModelInformation;
}): T[] | undefined {
  if (!tools || !suspendedTools?.length) return tools;

  const resumeSchemas = schemasForSuspendedTools({ suspendedTools, model });
  if (resumeSchemas.size === 0) return tools;

  return tools.map(tool => {
    if (!isPreparedFunctionTool(tool)) return tool;

    const schemas = resumeSchemas.get(tool.name);
    if (!schemas?.length) return tool;

    const inputSchema = tool.inputSchema;
    if (inputSchema.type !== 'object' && inputSchema.properties === undefined) return tool;

    const resumeDataSchema =
      schemas.length === 1
        ? rewriteLocalRefs(schemas[0], '#/properties/resumeData')
        : {
            anyOf: schemas.map((schema, index) => rewriteLocalRefs(schema, `#/properties/resumeData/anyOf/${index}`)),
          };
    const resumeDataSchemaObject = resumeDataSchema as Record<string, unknown>;
    const properties = {
      ...((inputSchema.properties as Record<string, unknown> | undefined) ?? {}),
      suspendedToolRunId: {
        type: 'string',
        description: 'The runId of the suspended tool',
      },
      resumeData: {
        ...resumeDataSchemaObject,
        description:
          typeof resumeDataSchemaObject.description === 'string'
            ? resumeDataSchemaObject.description
            : 'Data used to resume the suspended tool',
      },
    };
    const required = Array.from(
      new Set([...((inputSchema.required as string[] | undefined) ?? []), 'suspendedToolRunId', 'resumeData']),
    );

    return {
      ...tool,
      inputSchema: {
        ...inputSchema,
        properties,
        required,
      },
    };
  });
}
