import type { StoredAgentSkillConfig, StoredWorkspaceRef, ConditionalField } from '@mastra/client-js';
import type { AgentInstructionBlock, StorageConditionalVariant } from '@mastra/core/storage';

import type {
  EntityConfig,
  ScorerConfig,
  SkillConfig,
  InstructionBlock,
  AgentFormValues,
} from '../components/agent-edit-page/utils/form-validation';
import { createInstructionBlock, createRefInstructionBlock } from '../components/agent-edit-page/utils/form-validation';

// ---------------------------------------------------------------------------
// Primitive helpers
// ---------------------------------------------------------------------------

/** Convert a `string[]` to `Record<string, EntityConfig>`. */
export const arrayToRecord = (arr: string[]): Record<string, EntityConfig> => {
  const record: Record<string, EntityConfig> = {};
  for (const id of arr) {
    record[id] = { description: undefined };
  }
  return record;
};

/** Normalize tools from `string[]` (legacy), `Record`, or `ConditionalVariant[]` format. */
export const normalizeToolsToRecord = (
  tools:
    | string[]
    | Record<string, EntityConfig>
    | StorageConditionalVariant<Record<string, EntityConfig>>[]
    | undefined,
): Record<string, EntityConfig> => {
  if (!tools) return {};
  if (!Array.isArray(tools)) return { ...tools };
  const result: Record<string, EntityConfig> = {};
  for (const item of tools) {
    if (typeof item === 'string') {
      result[item] = { description: undefined };
    } else {
      Object.assign(result, item.value);
    }
  }
  return result;
};

/** Split `"provider/name"` into `{ provider, name }`. */
export const splitModelId = (id?: string): { provider: string; name: string } | undefined => {
  if (!id) return undefined;
  const [p, ...rest] = id.split('/');
  const n = rest.join('/');
  return p && n ? { provider: p, name: n } : undefined;
};

/** Join `{ provider, name }` into `"provider/name"`. */
export const joinModelId = (m?: { provider?: string; name?: string }): string | undefined =>
  m?.provider && m?.name ? `${m.provider}/${m.name}` : undefined;

// ---------------------------------------------------------------------------
// Integration tools
// ---------------------------------------------------------------------------

/** Transform flat form keys (`"providerId:toolSlug"`) to nested API format.
 *  Returns `{}` (not `undefined`) when there are no integration tools so that the
 *  server auto-versioning layer sees an explicit "cleared" value instead of
 *  interpreting `undefined` as "no change" and preserving stale tools.
 */
export const transformIntegrationToolsForApi = (
  integrationTools: Record<string, EntityConfig> | undefined,
): Record<string, { tools?: Record<string, EntityConfig> }> => {
  if (!integrationTools || Object.keys(integrationTools).length === 0) return {};

  const result: Record<string, { tools?: Record<string, EntityConfig> }> = {};
  for (const [compositeKey, config] of Object.entries(integrationTools)) {
    const separatorIndex = compositeKey.indexOf(':');
    if (separatorIndex === -1) continue;
    const providerId = compositeKey.slice(0, separatorIndex);
    const toolSlug = compositeKey.slice(separatorIndex + 1);

    if (!result[providerId]) {
      result[providerId] = { tools: {} };
    }
    result[providerId].tools![toolSlug] = { description: config.description, rules: config.rules };
  }
  return result;
};

/** Transform nested API integration tools to flat form format. */
export const normalizeIntegrationToolsToRecord = (
  integrationTools: Record<string, { tools?: Record<string, EntityConfig> }> | undefined,
): Record<string, EntityConfig> => {
  if (!integrationTools) return {};

  const result: Record<string, EntityConfig> = {};
  for (const [providerId, providerConfig] of Object.entries(integrationTools)) {
    if (providerConfig.tools) {
      for (const [toolSlug, toolConfig] of Object.entries(providerConfig.tools)) {
        result[`${providerId}:${toolSlug}`] = { description: toolConfig.description, rules: toolConfig.rules };
      }
    }
  }
  return result;
};

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------

/** Normalize API skills (ConditionalField<Record<string, StoredAgentSkillConfig>>) to form SkillConfig records. */
export const normalizeSkillsFromApi = (
  skills: ConditionalField<Record<string, StoredAgentSkillConfig>> | undefined,
): Record<string, SkillConfig> => {
  if (!skills) return {};

  // Conditional variants array — merge all variant values
  if (Array.isArray(skills)) {
    const result: Record<string, SkillConfig> = {};
    for (const variant of skills) {
      for (const [key, value] of Object.entries(variant.value)) {
        result[key] = {
          description: value.description,
          instructions: value.instructions,
          pin: value.pin,
          strategy: value.strategy,
        };
      }
    }
    return result;
  }

  // Static record
  const result: Record<string, SkillConfig> = {};
  for (const [key, value] of Object.entries(skills)) {
    result[key] = {
      description: value.description,
      instructions: value.instructions,
      pin: value.pin,
      strategy: value.strategy,
    };
  }
  return result;
};

// ---------------------------------------------------------------------------
// Workspace
// ---------------------------------------------------------------------------

/** Normalize API workspace ref (ConditionalField<StoredWorkspaceRef>) to a static workspace ref. */
export const normalizeWorkspaceFromApi = (
  workspace: ConditionalField<StoredWorkspaceRef> | undefined,
): StoredWorkspaceRef | undefined => {
  if (!workspace) return undefined;

  // Conditional variants array — take the first value
  if (Array.isArray(workspace)) {
    return workspace[0]?.value as StoredWorkspaceRef | undefined;
  }

  return workspace as StoredWorkspaceRef;
};

// ---------------------------------------------------------------------------
// Instruction blocks
// ---------------------------------------------------------------------------

/** Map form instruction blocks to the API instruction array. */
export const mapInstructionBlocksToApi = (blocks: InstructionBlock[] | undefined): AgentInstructionBlock[] =>
  (blocks ?? []).map(block => {
    if (block.type === 'prompt_block_ref') {
      return { type: 'prompt_block_ref' as const, id: block.promptBlockId };
    }
    return { type: 'prompt_block' as const, content: block.content, rules: block.rules };
  });

/** Normalize block content that may be a string or a legacy `{ content, role }` object. */
const normalizeBlockContent = (content: unknown): string => {
  if (typeof content === 'string') return content;
  if (content && typeof content === 'object' && 'content' in content) {
    return typeof (content as { content: unknown }).content === 'string'
      ? (content as { content: string }).content
      : '';
  }
  return '';
};

/**
 * Normalize a raw `instructions` value from the API (which can be any
 * `SystemMessage` variant) into a plain string.  This handles:
 *  - `string`
 *  - `CoreSystemMessage` (`{ role: 'system', content: string }`)
 *  - `string[]` / `CoreSystemMessage[]`
 */
const normalizeSystemMessage = (raw: unknown): string => {
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw)) return raw.map(normalizeSystemMessage).filter(Boolean).join('\n\n');
  if (raw && typeof raw === 'object' && 'content' in raw) {
    const c = (raw as { content: unknown }).content;
    return typeof c === 'string' ? c : '';
  }
  return '';
};

/** Map API instruction data to form instruction blocks. */
export const mapInstructionBlocksFromApi = (
  instructionsRaw: string | AgentInstructionBlock[] | unknown,
): { instructionsString: string; instructionBlocks: InstructionBlock[] } => {
  // If the raw value is an AgentInstructionBlock[] (array of objects with `type`),
  // process each block individually.
  const isBlockArray =
    Array.isArray(instructionsRaw) &&
    instructionsRaw.length > 0 &&
    typeof instructionsRaw[0] === 'object' &&
    'type' in instructionsRaw[0];

  if (isBlockArray) {
    const blocks = instructionsRaw as AgentInstructionBlock[];
    const instructionsString = blocks
      .map((b: AgentInstructionBlock) => (b.type === 'prompt_block' ? normalizeBlockContent(b.content) : ''))
      .filter(Boolean)
      .join('\n\n');

    const instructionBlocks: InstructionBlock[] = blocks
      .filter(
        (b: AgentInstructionBlock): b is Exclude<AgentInstructionBlock, { type: 'text' }> =>
          b.type === 'prompt_block' || b.type === 'prompt_block_ref',
      )
      .map(b => {
        if (b.type === 'prompt_block_ref') {
          return createRefInstructionBlock(b.id);
        }
        return createInstructionBlock(normalizeBlockContent(b.content), b.rules);
      });

    return { instructionsString, instructionBlocks };
  }

  // For any other SystemMessage variant (string, CoreSystemMessage, string[],
  // CoreSystemMessage[]), normalize to a plain string.
  const normalized = normalizeSystemMessage(instructionsRaw);
  return {
    instructionsString: normalized,
    instructionBlocks: [createInstructionBlock(normalized)],
  };
};

// ---------------------------------------------------------------------------
// Scorers
// ---------------------------------------------------------------------------

type ScorerFormValues = NonNullable<AgentFormValues['scorers']>;

/** Map form scorers to the API scorers format. */
export const mapScorersToApi = (
  scorers: ScorerFormValues | undefined,
):
  | Record<
      string,
      {
        description?: string;
        sampling?: { type: 'ratio'; rate: number };
        rules?: EntityConfig['rules'];
      }
    >
  | undefined => {
  const entries = scorers ? Object.entries(scorers) : undefined;
  if (!entries) return undefined;

  return Object.fromEntries(
    entries.map(([key, value]) => [
      key,
      {
        description: value.description,
        sampling: value.sampling
          ? {
              type: value.sampling.type,
              rate: value.sampling.rate || 0,
            }
          : undefined,
        rules: value.rules,
      },
    ]),
  );
};

/** Normalize API scorers (possibly wrapped in ConditionalField) to form format. */
export const normalizeScorersFromApi = (
  scorers:
    | Record<
        string,
        { description?: string; sampling?: { type: string; rate?: number }; rules?: EntityConfig['rules'] }
      >
    | StorageConditionalVariant<
        Record<
          string,
          { description?: string; sampling?: { type: string; rate?: number }; rules?: EntityConfig['rules'] }
        >
      >[]
    | undefined,
): Record<string, ScorerConfig> => {
  if (!scorers) return {};
  let record: Record<
    string,
    { description?: string; sampling?: { type: string; rate?: number }; rules?: EntityConfig['rules'] }
  >;
  if (Array.isArray(scorers)) {
    record = {};
    for (const variant of scorers) {
      Object.assign(record, variant.value);
    }
  } else {
    record = scorers;
  }
  const result: Record<string, ScorerConfig> = {};
  for (const [key, value] of Object.entries(record)) {
    result[key] = {
      description: value.description,
      sampling: value.sampling?.type === 'ratio' ? { type: 'ratio', rate: value.sampling.rate } : undefined,
      rules: value.rules,
    };
  }
  return result;
};

// ---------------------------------------------------------------------------
// Observational memory
// ---------------------------------------------------------------------------

type ObservationalMemoryForm = NonNullable<NonNullable<AgentFormValues['memory']>['observationalMemory']>;

/**
 * Build the API representation of observational memory from form values.
 *
 * Returns `true` (enable with defaults), an object with config, or `undefined`
 * (disabled).
 */
export const buildObservationalMemoryForApi = (
  om: ObservationalMemoryForm | undefined,
):
  | boolean
  | {
      model?: string;
      scope?: 'resource' | 'thread';
      shareTokenBudget?: boolean;
      observation?: {
        model?: string;
        messageTokens?: number;
        maxTokensPerBatch?: number;
        bufferTokens?: number | false;
        bufferActivation?: number;
        blockAfter?: number;
      };
      reflection?: {
        model?: string;
        observationTokens?: number;
        blockAfter?: number;
        bufferActivation?: number;
      };
    }
  | undefined => {
  if (!om?.enabled) return undefined;

  const modelId = joinModelId(om.model);

  const obsModelId = joinModelId(om.observation?.model);
  const observation =
    obsModelId ||
    om.observation?.messageTokens ||
    om.observation?.maxTokensPerBatch ||
    om.observation?.bufferTokens !== undefined ||
    om.observation?.bufferActivation !== undefined ||
    om.observation?.blockAfter !== undefined
      ? {
          model: obsModelId,
          messageTokens: om.observation?.messageTokens,
          maxTokensPerBatch: om.observation?.maxTokensPerBatch,
          bufferTokens: om.observation?.bufferTokens,
          bufferActivation: om.observation?.bufferActivation,
          blockAfter: om.observation?.blockAfter,
        }
      : undefined;

  const refModelId = joinModelId(om.reflection?.model);
  const reflection =
    refModelId ||
    om.reflection?.observationTokens ||
    om.reflection?.blockAfter !== undefined ||
    om.reflection?.bufferActivation !== undefined
      ? {
          model: refModelId,
          observationTokens: om.reflection?.observationTokens,
          blockAfter: om.reflection?.blockAfter,
          bufferActivation: om.reflection?.bufferActivation,
        }
      : undefined;

  return modelId || om.scope || om.shareTokenBudget || observation || reflection
    ? {
        model: modelId,
        scope: om.scope,
        shareTokenBudget: om.shareTokenBudget,
        observation,
        reflection,
      }
    : true;
};

type ApiObservationalMemory =
  | boolean
  | {
      model?: string;
      scope?: 'resource' | 'thread';
      shareTokenBudget?: boolean;
      observation?: {
        model?: string;
        messageTokens?: number;
        maxTokensPerBatch?: number;
        bufferTokens?: number | false;
        bufferActivation?: number;
        blockAfter?: number;
      };
      reflection?: {
        model?: string;
        observationTokens?: number;
        blockAfter?: number;
        bufferActivation?: number;
      };
    };

/** Parse API observational memory config into the form representation. */
export const parseObservationalMemoryFromApi = (
  raw: ApiObservationalMemory | undefined,
): ObservationalMemoryForm | undefined => {
  if (!raw) return undefined;

  const om = typeof raw === 'object' ? raw : {};
  return {
    enabled: true as const,
    model: splitModelId(om.model),
    scope: om.scope,
    shareTokenBudget: om.shareTokenBudget,
    observation: om.observation
      ? {
          model: splitModelId(om.observation.model),
          messageTokens: om.observation.messageTokens,
          maxTokensPerBatch: om.observation.maxTokensPerBatch,
          bufferTokens: om.observation.bufferTokens,
          bufferActivation: om.observation.bufferActivation,
          blockAfter: om.observation.blockAfter,
        }
      : undefined,
    reflection: om.reflection
      ? {
          model: splitModelId(om.reflection.model),
          observationTokens: om.reflection.observationTokens,
          blockAfter: om.reflection.blockAfter,
          bufferActivation: om.reflection.bufferActivation,
        }
      : undefined,
  };
};
