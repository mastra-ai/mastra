function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

type ProcessorToolSummary = {
  id: string;
  name: string;
  description?: string;
};

type ActiveToolSummary = {
  id: string;
  name: string;
};

function summarizeProcessorToolEntry(key: string, value: unknown): ProcessorToolSummary {
  if (!isPlainObject(value)) {
    return {
      id: key,
      name: key,
    };
  }

  const id = readString(value.id) ?? key;
  const name = readString(value.name) ?? id;
  const description = readString(value.description);

  return {
    id,
    name,
    ...(description !== undefined ? { description } : {}),
  };
}

export function summarizeProcessorModelForSpan(value: unknown):
  | {
      modelId?: string;
      provider?: string;
      specificationVersion?: string;
    }
  | undefined {
  if (!isPlainObject(value)) {
    return undefined;
  }

  const modelId = readString(value.modelId) ?? readString(value.id);
  const provider = readString(value.provider);
  const specificationVersion = readString(value.specificationVersion);

  if (modelId === undefined && provider === undefined && specificationVersion === undefined) {
    return undefined;
  }

  return {
    ...(modelId !== undefined ? { modelId } : {}),
    ...(provider !== undefined ? { provider } : {}),
    ...(specificationVersion !== undefined ? { specificationVersion } : {}),
  };
}

export function summarizeProcessorToolsForSpan(tools: unknown): ProcessorToolSummary[] | undefined {
  if (!isPlainObject(tools)) {
    return undefined;
  }

  return Object.entries(tools).map(([key, value]) => summarizeProcessorToolEntry(key, value));
}

function summarizeProcessorToolRegistry(
  tools: unknown,
): Array<{ registryKey: string; summary: ProcessorToolSummary }> | undefined {
  if (!isPlainObject(tools)) {
    return undefined;
  }

  const summaries = summarizeProcessorToolsForSpan(tools);
  if (!summaries) {
    return undefined;
  }

  return Object.keys(tools).map((registryKey, index) => ({
    registryKey,
    summary: summaries[index]!,
  }));
}

function resolveToolInRegistry(
  toolRegistry: Array<{ registryKey: string; summary: ProcessorToolSummary }>,
  toolKey: string,
) {
  return toolRegistry.find(
    candidate =>
      candidate.summary.id === toolKey || candidate.summary.name === toolKey || candidate.registryKey === toolKey,
  );
}

export function summarizeActiveToolsForSpan(activeTools: unknown, tools?: unknown): ActiveToolSummary[] | undefined {
  if (!Array.isArray(activeTools)) {
    return undefined;
  }

  const toolRegistry = summarizeProcessorToolRegistry(tools) ?? [];
  const summaries = activeTools
    .map(tool => {
      const toolKey = readString(tool);
      if (toolKey === undefined) {
        return undefined;
      }

      const match = resolveToolInRegistry(toolRegistry, toolKey);
      return {
        id: match?.summary.id ?? toolKey,
        name: match?.summary.name ?? toolKey,
      };
    })
    .filter((tool): tool is ActiveToolSummary => tool !== undefined);

  return summaries;
}

export function summarizeToolChoiceForSpan(
  toolChoice: unknown,
  tools?: unknown,
):
  | {
      type: string;
      tool?: ActiveToolSummary;
    }
  | undefined {
  if (typeof toolChoice === 'string') {
    return { type: toolChoice };
  }

  if (!isPlainObject(toolChoice)) {
    return undefined;
  }

  const type = readString(toolChoice.type);
  if (type === undefined) {
    return undefined;
  }

  if (type !== 'tool') {
    return { type };
  }

  const toolKey = readString(toolChoice.toolName) ?? readString(toolChoice.toolId);
  if (toolKey === undefined) {
    return { type };
  }

  const toolRegistry = summarizeProcessorToolRegistry(tools) ?? [];
  const match = resolveToolInRegistry(toolRegistry, toolKey);
  const fallbackToolId = readString(toolChoice.toolId) ?? toolKey;
  const fallbackToolName = readString(toolChoice.toolName) ?? toolKey;

  return {
    type,
    tool: match
      ? {
          id: match.summary.id,
          name: match.summary.name,
        }
      : {
          id: fallbackToolId,
          name: fallbackToolName,
        },
  };
}

export function summarizeProcessorResultForSpan(value: unknown): Record<string, unknown> | undefined {
  if (!isPlainObject(value)) {
    return undefined;
  }

  const projected: Record<string, unknown> = {};
  for (const key of [
    'text',
    'object',
    'finishReason',
    'toolCalls',
    'toolResults',
    'warnings',
    'files',
    'sources',
    'reasoning',
    'reasoningText',
    'tripwire',
  ] as const) {
    if (value[key] !== undefined) {
      projected[key] = value[key];
    }
  }

  if (Array.isArray(value.steps)) {
    projected.stepCount = value.steps.length;
  }

  return Object.keys(projected).length > 0 ? projected : undefined;
}
