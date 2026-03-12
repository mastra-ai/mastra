import { describe, it, expect } from 'vitest';
import {
  arrayToRecord,
  normalizeToolsToRecord,
  splitModelId,
  joinModelId,
  transformIntegrationToolsForApi,
  normalizeIntegrationToolsToRecord,
  mapInstructionBlocksToApi,
  mapInstructionBlocksFromApi,
  mapScorersToApi,
  buildObservationalMemoryForApi,
  parseObservationalMemoryFromApi,
} from '../agent-form-mappers';

// ---------------------------------------------------------------------------
// arrayToRecord
// ---------------------------------------------------------------------------
describe('arrayToRecord', () => {
  it('converts a string array to a record', () => {
    expect(arrayToRecord(['a', 'b'])).toEqual({
      a: { description: undefined },
      b: { description: undefined },
    });
  });

  it('returns empty record for empty array', () => {
    expect(arrayToRecord([])).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// normalizeToolsToRecord
// ---------------------------------------------------------------------------
describe('normalizeToolsToRecord', () => {
  it('returns empty record for undefined', () => {
    expect(normalizeToolsToRecord(undefined)).toEqual({});
  });

  it('converts string array via arrayToRecord', () => {
    expect(normalizeToolsToRecord(['x'])).toEqual({ x: { description: undefined } });
  });

  it('shallow-copies an existing record', () => {
    const input = { t: { description: 'desc' } };
    const result = normalizeToolsToRecord(input);
    expect(result).toEqual(input);
    expect(result).not.toBe(input);
  });
});

// ---------------------------------------------------------------------------
// splitModelId / joinModelId
// ---------------------------------------------------------------------------
describe('splitModelId', () => {
  it('splits "provider/name"', () => {
    expect(splitModelId('openai/gpt-4')).toEqual({ provider: 'openai', name: 'gpt-4' });
  });

  it('handles model names with slashes', () => {
    expect(splitModelId('google/models/gemini-2.0')).toEqual({ provider: 'google', name: 'models/gemini-2.0' });
  });

  it('returns undefined for undefined input', () => {
    expect(splitModelId(undefined)).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(splitModelId('')).toBeUndefined();
  });

  it('returns undefined for string without slash', () => {
    expect(splitModelId('noSlash')).toBeUndefined();
  });
});

describe('joinModelId', () => {
  it('joins provider and name', () => {
    expect(joinModelId({ provider: 'openai', name: 'gpt-4' })).toBe('openai/gpt-4');
  });

  it('returns undefined when provider is missing', () => {
    expect(joinModelId({ name: 'gpt-4' })).toBeUndefined();
  });

  it('returns undefined when name is missing', () => {
    expect(joinModelId({ provider: 'openai' })).toBeUndefined();
  });

  it('returns undefined for undefined input', () => {
    expect(joinModelId(undefined)).toBeUndefined();
  });
});

describe('splitModelId / joinModelId round-trip', () => {
  it('round-trips a simple id', () => {
    const id = 'openai/gpt-4';
    const split = splitModelId(id);
    expect(joinModelId(split)).toBe(id);
  });

  it('round-trips an id with nested slash', () => {
    const id = 'google/models/gemini-2.0';
    const split = splitModelId(id);
    expect(joinModelId(split)).toBe(id);
  });
});

// ---------------------------------------------------------------------------
// transformIntegrationToolsForApi / normalizeIntegrationToolsToRecord
// ---------------------------------------------------------------------------
describe('transformIntegrationToolsForApi', () => {
  it('returns undefined for undefined', () => {
    expect(transformIntegrationToolsForApi(undefined)).toBeUndefined();
  });

  it('returns undefined for empty object', () => {
    expect(transformIntegrationToolsForApi({})).toBeUndefined();
  });

  it('skips entries without colon separator', () => {
    expect(transformIntegrationToolsForApi({ noColon: { description: 'x' } })).toEqual({});
  });

  it('groups tools by provider', () => {
    const input = {
      'github:listRepos': { description: 'List repos' },
      'github:createPR': { description: 'Create PR' },
      'slack:sendMessage': { description: 'Send msg' },
    };
    expect(transformIntegrationToolsForApi(input)).toEqual({
      github: {
        tools: {
          listRepos: { description: 'List repos', rules: undefined },
          createPR: { description: 'Create PR', rules: undefined },
        },
      },
      slack: {
        tools: {
          sendMessage: { description: 'Send msg', rules: undefined },
        },
      },
    });
  });
});

describe('normalizeIntegrationToolsToRecord', () => {
  it('returns empty record for undefined', () => {
    expect(normalizeIntegrationToolsToRecord(undefined)).toEqual({});
  });

  it('flattens nested structure', () => {
    const input = {
      github: { tools: { listRepos: { description: 'List repos' } } },
    };
    expect(normalizeIntegrationToolsToRecord(input)).toEqual({
      'github:listRepos': { description: 'List repos', rules: undefined },
    });
  });

  it('skips providers with no tools', () => {
    const input = { github: {} };
    expect(normalizeIntegrationToolsToRecord(input)).toEqual({});
  });
});

describe('integration tools round-trip', () => {
  it('flat → nested → flat preserves data', () => {
    const flat = {
      'github:listRepos': { description: 'List repos' },
      'slack:sendMessage': { description: undefined },
    };
    const nested = transformIntegrationToolsForApi(flat)!;
    const backToFlat = normalizeIntegrationToolsToRecord(nested);
    expect(backToFlat).toEqual({
      'github:listRepos': { description: 'List repos', rules: undefined },
      'slack:sendMessage': { description: undefined, rules: undefined },
    });
  });
});

// ---------------------------------------------------------------------------
// mapInstructionBlocksToApi / mapInstructionBlocksFromApi
// ---------------------------------------------------------------------------
describe('mapInstructionBlocksToApi', () => {
  it('maps inline blocks stripping the id', () => {
    const blocks = [
      { id: '1', type: 'prompt_block' as const, content: 'Hello' },
      { id: '2', type: 'prompt_block' as const, content: 'World', rules: undefined },
    ];
    expect(mapInstructionBlocksToApi(blocks)).toEqual([
      { type: 'prompt_block', content: 'Hello', rules: undefined },
      { type: 'prompt_block', content: 'World', rules: undefined },
    ]);
  });

  it('maps ref blocks to prompt_block_ref with id', () => {
    const blocks = [{ id: 'ui-1', type: 'prompt_block_ref' as const, promptBlockId: 'saved-block-123' }];
    expect(mapInstructionBlocksToApi(blocks)).toEqual([{ type: 'prompt_block_ref', id: 'saved-block-123' }]);
  });

  it('maps mixed inline and ref blocks', () => {
    const blocks = [
      { id: '1', type: 'prompt_block' as const, content: 'Inline' },
      { id: '2', type: 'prompt_block_ref' as const, promptBlockId: 'ref-456' },
    ];
    expect(mapInstructionBlocksToApi(blocks)).toEqual([
      { type: 'prompt_block', content: 'Inline', rules: undefined },
      { type: 'prompt_block_ref', id: 'ref-456' },
    ]);
  });

  it('returns empty array for undefined', () => {
    expect(mapInstructionBlocksToApi(undefined)).toEqual([]);
  });
});

describe('mapInstructionBlocksFromApi', () => {
  it('parses array of prompt_block instructions', () => {
    const raw = [
      { type: 'prompt_block' as const, content: 'A' },
      { type: 'prompt_block' as const, content: 'B' },
    ];
    const { instructionsString, instructionBlocks } = mapInstructionBlocksFromApi(raw);
    expect(instructionsString).toBe('A\n\nB');
    expect(instructionBlocks).toHaveLength(2);
    expect(instructionBlocks[0].type).toBe('prompt_block');
    expect(instructionBlocks[1].type).toBe('prompt_block');
    if (instructionBlocks[0].type === 'prompt_block') {
      expect(instructionBlocks[0].content).toBe('A');
    }
    if (instructionBlocks[1].type === 'prompt_block') {
      expect(instructionBlocks[1].content).toBe('B');
    }
  });

  it('parses prompt_block_ref instructions', () => {
    const raw = [
      { type: 'prompt_block' as const, content: 'Inline' },
      { type: 'prompt_block_ref' as const, id: 'ref-123' },
    ];
    const { instructionBlocks } = mapInstructionBlocksFromApi(raw);
    expect(instructionBlocks).toHaveLength(2);
    expect(instructionBlocks[0].type).toBe('prompt_block');
    expect(instructionBlocks[1].type).toBe('prompt_block_ref');
    if (instructionBlocks[1].type === 'prompt_block_ref') {
      expect(instructionBlocks[1].promptBlockId).toBe('ref-123');
    }
  });

  it('filters out text type blocks', () => {
    const raw = [
      { type: 'prompt_block' as const, content: 'Keep' },
      { type: 'text' as const, content: 'Skip' },
    ];
    const { instructionBlocks } = mapInstructionBlocksFromApi(raw);
    expect(instructionBlocks).toHaveLength(1);
    expect(instructionBlocks[0].type).toBe('prompt_block');
  });

  it('handles plain string input', () => {
    const { instructionsString, instructionBlocks } = mapInstructionBlocksFromApi('Hello');
    expect(instructionsString).toBe('Hello');
    expect(instructionBlocks).toHaveLength(1);
    expect(instructionBlocks[0].type).toBe('prompt_block');
    if (instructionBlocks[0].type === 'prompt_block') {
      expect(instructionBlocks[0].content).toBe('Hello');
    }
  });

  it('handles undefined input', () => {
    const { instructionsString, instructionBlocks } = mapInstructionBlocksFromApi(undefined);
    expect(instructionsString).toBe('');
    expect(instructionBlocks).toHaveLength(1);
    expect(instructionBlocks[0].type).toBe('prompt_block');
    if (instructionBlocks[0].type === 'prompt_block') {
      expect(instructionBlocks[0].content).toBe('');
    }
  });
});

// ---------------------------------------------------------------------------
// mapScorersToApi
// ---------------------------------------------------------------------------
describe('mapScorersToApi', () => {
  it('returns undefined for undefined', () => {
    expect(mapScorersToApi(undefined)).toBeUndefined();
  });

  it('maps scorers with sampling', () => {
    const input = {
      accuracy: {
        description: 'Accuracy scorer',
        sampling: { type: 'ratio' as const, rate: 0.5 },
      },
    };
    expect(mapScorersToApi(input)).toEqual({
      accuracy: {
        description: 'Accuracy scorer',
        sampling: { type: 'ratio', rate: 0.5 },
        rules: undefined,
      },
    });
  });

  it('defaults rate to 0 when missing', () => {
    const input = {
      s: { description: 'd', sampling: { type: 'ratio' as const } },
    };
    const result = mapScorersToApi(input)!;
    expect(result.s.sampling!.rate).toBe(0);
  });

  it('omits sampling when not present', () => {
    const input = { s: { description: 'd' } };
    const result = mapScorersToApi(input)!;
    expect(result.s.sampling).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// buildObservationalMemoryForApi
// ---------------------------------------------------------------------------
describe('buildObservationalMemoryForApi', () => {
  it('returns undefined when disabled', () => {
    expect(buildObservationalMemoryForApi(undefined)).toBeUndefined();
    expect(buildObservationalMemoryForApi({ enabled: false })).toBeUndefined();
  });

  it('returns true for enabled with no extra config', () => {
    expect(buildObservationalMemoryForApi({ enabled: true })).toBe(true);
  });

  it('returns config object when model is set', () => {
    const result = buildObservationalMemoryForApi({
      enabled: true,
      model: { provider: 'openai', name: 'gpt-4' },
    });
    expect(result).toEqual({
      model: 'openai/gpt-4',
      scope: undefined,
      shareTokenBudget: undefined,
      observation: undefined,
      reflection: undefined,
    });
  });

  it('returns config when scope is set', () => {
    const result = buildObservationalMemoryForApi({
      enabled: true,
      scope: 'thread',
    });
    expect(result).toEqual(expect.objectContaining({ scope: 'thread' }));
  });

  it('builds observation sub-config', () => {
    const result = buildObservationalMemoryForApi({
      enabled: true,
      observation: {
        model: { provider: 'openai', name: 'gpt-4o' },
        messageTokens: 1000,
      },
    });
    expect(typeof result).toBe('object');
    expect((result as any).observation).toEqual({
      model: 'openai/gpt-4o',
      messageTokens: 1000,
      maxTokensPerBatch: undefined,
      bufferTokens: undefined,
      bufferActivation: undefined,
      blockAfter: undefined,
    });
  });

  it('builds reflection sub-config', () => {
    const result = buildObservationalMemoryForApi({
      enabled: true,
      reflection: {
        model: { provider: 'anthropic', name: 'claude-3' },
        observationTokens: 500,
      },
    });
    expect(typeof result).toBe('object');
    expect((result as any).reflection).toEqual({
      model: 'anthropic/claude-3',
      observationTokens: 500,
      blockAfter: undefined,
      bufferActivation: undefined,
    });
  });
});

// ---------------------------------------------------------------------------
// parseObservationalMemoryFromApi
// ---------------------------------------------------------------------------
describe('parseObservationalMemoryFromApi', () => {
  it('returns undefined for undefined', () => {
    expect(parseObservationalMemoryFromApi(undefined)).toBeUndefined();
  });

  it('returns enabled with defaults for boolean true', () => {
    const result = parseObservationalMemoryFromApi(true)!;
    expect(result.enabled).toBe(true);
    expect(result.model).toBeUndefined();
    expect(result.observation).toBeUndefined();
    expect(result.reflection).toBeUndefined();
  });

  it('parses full config', () => {
    const result = parseObservationalMemoryFromApi({
      model: 'openai/gpt-4',
      scope: 'thread',
      shareTokenBudget: true,
      observation: {
        model: 'openai/gpt-4o',
        messageTokens: 1000,
        maxTokensPerBatch: 2000,
        bufferTokens: 500,
        bufferActivation: 0.8,
        blockAfter: 10,
      },
      reflection: {
        model: 'anthropic/claude-3',
        observationTokens: 500,
        blockAfter: 5,
        bufferActivation: 0.5,
      },
    })!;

    expect(result.enabled).toBe(true);
    expect(result.model).toEqual({ provider: 'openai', name: 'gpt-4' });
    expect(result.scope).toBe('thread');
    expect(result.shareTokenBudget).toBe(true);
    expect(result.observation!.model).toEqual({ provider: 'openai', name: 'gpt-4o' });
    expect(result.observation!.messageTokens).toBe(1000);
    expect(result.reflection!.model).toEqual({ provider: 'anthropic', name: 'claude-3' });
    expect(result.reflection!.observationTokens).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// buildObservationalMemoryForApi / parseObservationalMemoryFromApi round-trip
// ---------------------------------------------------------------------------
describe('observational memory round-trip', () => {
  it('build → parse preserves data (with config)', () => {
    const form = {
      enabled: true as const,
      model: { provider: 'openai', name: 'gpt-4' },
      scope: 'thread' as const,
      shareTokenBudget: true,
      observation: {
        model: { provider: 'openai', name: 'gpt-4o' },
        messageTokens: 1000,
      },
      reflection: {
        model: { provider: 'anthropic', name: 'claude-3' },
        observationTokens: 500,
      },
    };

    const api = buildObservationalMemoryForApi(form);
    const parsed = parseObservationalMemoryFromApi(api as any)!;

    expect(parsed.enabled).toBe(true);
    expect(parsed.model).toEqual(form.model);
    expect(parsed.scope).toBe(form.scope);
    expect(parsed.shareTokenBudget).toBe(form.shareTokenBudget);
    expect(parsed.observation!.model).toEqual(form.observation.model);
    expect(parsed.observation!.messageTokens).toBe(form.observation.messageTokens);
    expect(parsed.reflection!.model).toEqual(form.reflection.model);
    expect(parsed.reflection!.observationTokens).toBe(form.reflection.observationTokens);
  });

  it('build → parse round-trips boolean true', () => {
    const api = buildObservationalMemoryForApi({ enabled: true });
    expect(api).toBe(true);
    const parsed = parseObservationalMemoryFromApi(api as any)!;
    expect(parsed.enabled).toBe(true);
  });
});
