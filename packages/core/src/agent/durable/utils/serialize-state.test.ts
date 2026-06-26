/**
 * Tests for packages/core/src/agent/durable/utils/serialize-state.ts
 *
 * All helpers under test are pure functions — no I/O, no async behaviour,
 * no mocking required. The suite covers every exported utility that can be
 * exercised without a live LLM or message-list object.
 */
import { describe, expect, it } from 'vitest';

import {
  deserializeDate,
  serializeDate,
  serializeDurableOptions,
  serializeDurableState,
  serializeError,
  serializeModelConfig,
  serializeModelList,
  serializeScorersConfig,
  serializeToolMetadata,
  serializeToolsMetadata,
} from './serialize-state';

// ---------------------------------------------------------------------------
// serializeError
// ---------------------------------------------------------------------------

describe('serializeError', () => {
  it('serialises a plain Error instance', () => {
    const err = new Error('something broke');
    const result = serializeError(err);
    expect(result.name).toBe('Error');
    expect(result.message).toBe('something broke');
    expect(result.stack).toBeDefined();
  });

  it('serialises a subclassed Error preserving name', () => {
    class CustomError extends Error {
      constructor(msg: string) {
        super(msg);
        this.name = 'CustomError';
      }
    }
    const result = serializeError(new CustomError('custom'));
    expect(result.name).toBe('CustomError');
    expect(result.message).toBe('custom');
  });

  it('serialises a string as an Error with name "Error"', () => {
    const result = serializeError('raw string error');
    expect(result.name).toBe('Error');
    expect(result.message).toBe('raw string error');
    expect(result.stack).toBeUndefined();
  });

  it('serialises a number', () => {
    const result = serializeError(42);
    expect(result.name).toBe('Error');
    expect(result.message).toBe('42');
  });

  it('serialises null', () => {
    const result = serializeError(null);
    expect(result.name).toBe('Error');
    expect(result.message).toBe('null');
  });

  it('serialises undefined', () => {
    const result = serializeError(undefined);
    expect(result.name).toBe('Error');
    expect(result.message).toBe('undefined');
  });

  it('serialises a plain object via String()', () => {
    const result = serializeError({ code: 500 });
    expect(result.name).toBe('Error');
    expect(result.message).toBe('[object Object]');
  });
});

// ---------------------------------------------------------------------------
// serializeDate / deserializeDate
// ---------------------------------------------------------------------------

describe('serializeDate', () => {
  it('converts a Date to an ISO 8601 string', () => {
    const d = new Date('2024-03-15T12:00:00.000Z');
    expect(serializeDate(d)).toBe('2024-03-15T12:00:00.000Z');
  });

  it('returns undefined for undefined input', () => {
    expect(serializeDate(undefined)).toBeUndefined();
  });

  it('round-trips through deserializeDate', () => {
    const original = new Date('2025-01-01T00:00:00.000Z');
    const iso = serializeDate(original);
    const restored = deserializeDate(iso);
    expect(restored?.getTime()).toBe(original.getTime());
  });
});

describe('deserializeDate', () => {
  it('converts an ISO string back to a Date', () => {
    const result = deserializeDate('2024-06-01T10:30:00.000Z');
    expect(result).toBeInstanceOf(Date);
    expect(result?.toISOString()).toBe('2024-06-01T10:30:00.000Z');
  });

  it('returns undefined for undefined input', () => {
    expect(deserializeDate(undefined)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// serializeModelConfig
// ---------------------------------------------------------------------------

describe('serializeModelConfig', () => {
  const fakeModel = {
    provider: 'openai',
    modelId: 'gpt-4o',
    specificationVersion: 'v1' as any,
  } as any;

  it('extracts provider, modelId, and specificationVersion', () => {
    const result = serializeModelConfig(fakeModel);
    expect(result.provider).toBe('openai');
    expect(result.modelId).toBe('gpt-4o');
    expect(result.specificationVersion).toBe('v1');
  });

  it('builds originalConfig as "provider/modelId"', () => {
    const result = serializeModelConfig(fakeModel);
    expect(result.originalConfig).toBe('openai/gpt-4o');
  });

  it('does not include model settings (those come from execution options)', () => {
    const result = serializeModelConfig(fakeModel);
    expect(result).not.toHaveProperty('settings');
    expect(result).not.toHaveProperty('temperature');
  });
});

// ---------------------------------------------------------------------------
// serializeModelList
// ---------------------------------------------------------------------------

describe('serializeModelList', () => {
  const makeEntry = (id: string, enabled?: boolean) => ({
    id,
    model: { provider: 'openai', modelId: 'gpt-4o', specificationVersion: 'v1' as any } as any,
    maxRetries: 3,
    enabled,
  });

  it('serialises all entries when none are disabled', () => {
    const result = serializeModelList([makeEntry('a'), makeEntry('b')]);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('a');
    expect(result[1].id).toBe('b');
  });

  it('filters out entries where enabled = false', () => {
    const result = serializeModelList([makeEntry('a', true), makeEntry('b', false)]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a');
  });

  it('keeps entries where enabled is undefined (default on)', () => {
    const result = serializeModelList([makeEntry('a', undefined)]);
    expect(result).toHaveLength(1);
  });

  it('returns empty array for empty input', () => {
    expect(serializeModelList([])).toEqual([]);
  });

  it('includes maxRetries in each entry', () => {
    const result = serializeModelList([makeEntry('x')]);
    expect(result[0].maxRetries).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// serializeScorersConfig
// ---------------------------------------------------------------------------

describe('serializeScorersConfig', () => {
  it('extracts scorerName from a scorer object with name property', () => {
    const result = serializeScorersConfig({
      accuracy: { scorer: { name: 'AccuracyScorer' } },
    });
    expect(result.accuracy.scorerName).toBe('AccuracyScorer');
  });

  it('uses the scorer string directly when scorer is a string', () => {
    const result = serializeScorersConfig({
      quality: { scorer: 'QualityScorer' },
    });
    expect(result.quality.scorerName).toBe('QualityScorer');
  });

  it('includes sampling config when provided', () => {
    const result = serializeScorersConfig({
      perf: { scorer: 'PerfScorer', sampling: { type: 'ratio', rate: 0.5 } },
    });
    expect(result.perf.sampling).toEqual({ type: 'ratio', rate: 0.5 });
  });

  it('omits sampling when not provided', () => {
    const result = serializeScorersConfig({
      basic: { scorer: 'BasicScorer' },
    });
    expect(result.basic).not.toHaveProperty('sampling');
  });

  it('handles multiple scorers', () => {
    const result = serializeScorersConfig({
      a: { scorer: 'A' },
      b: { scorer: 'B', sampling: { type: 'none' } },
    });
    expect(Object.keys(result)).toHaveLength(2);
    expect(result.a.scorerName).toBe('A');
    expect(result.b.sampling).toEqual({ type: 'none' });
  });

  it('returns empty object for empty input', () => {
    expect(serializeScorersConfig({})).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// serializeDurableState
// ---------------------------------------------------------------------------

describe('serializeDurableState', () => {
  it('serialises all provided fields', () => {
    const result = serializeDurableState({
      threadId: 'thread-1',
      resourceId: 'resource-1',
      threadExists: true,
      savePerStep: false,
      observationalMemory: true,
    });
    expect(result.threadId).toBe('thread-1');
    expect(result.resourceId).toBe('resource-1');
    expect(result.threadExists).toBe(true);
    expect(result.savePerStep).toBe(false);
    expect(result.observationalMemory).toBe(true);
  });

  it('returns undefined for omitted optional fields', () => {
    const result = serializeDurableState({});
    expect(result.threadId).toBeUndefined();
    expect(result.resourceId).toBeUndefined();
  });

  it('preserves memoryConfig when provided', () => {
    const memCfg = { lastMessages: 10 } as any;
    const result = serializeDurableState({ memoryConfig: memCfg });
    expect(result.memoryConfig).toEqual({ lastMessages: 10 });
  });
});

// ---------------------------------------------------------------------------
// serializeDurableOptions
// ---------------------------------------------------------------------------

describe('serializeDurableOptions', () => {
  it('serialises basic scalar options', () => {
    const result = serializeDurableOptions({
      maxSteps: 10,
      modelSettings: { temperature: 0.7 },
      requireToolApproval: true,
    });
    expect(result.maxSteps).toBe(10);
    expect(result.modelSettings?.temperature).toBe(0.7);
    expect(result.requireToolApproval).toBe(true);
  });

  it('serialises string toolChoice directly', () => {
    const result = serializeDurableOptions({ toolChoice: 'auto' });
    expect(result.toolChoice).toBe('auto');
  });

  it('serialises "none" and "required" toolChoice strings', () => {
    expect(serializeDurableOptions({ toolChoice: 'none' }).toolChoice).toBe('none');
    expect(serializeDurableOptions({ toolChoice: 'required' }).toolChoice).toBe('required');
  });

  it('serialises { type: "tool", toolName } object toolChoice', () => {
    const result = serializeDurableOptions({
      toolChoice: { type: 'tool', toolName: 'search' },
    });
    expect(result.toolChoice).toEqual({ type: 'tool', toolName: 'search' });
  });

  it('leaves toolChoice undefined when not provided', () => {
    const result = serializeDurableOptions({});
    expect(result.toolChoice).toBeUndefined();
  });

  it('drops unknown toolChoice object shapes', () => {
    const result = serializeDurableOptions({
      toolChoice: { type: 'unknown-type' } as any,
    });
    expect(result.toolChoice).toBeUndefined();
  });

  it('preserves activeTools array', () => {
    const result = serializeDurableOptions({ activeTools: ['search', 'calculator'] });
    expect(result.activeTools).toEqual(['search', 'calculator']);
  });

  it('returns all undefined when options is empty', () => {
    const result = serializeDurableOptions({});
    expect(result.maxSteps).toBeUndefined();
    expect(result.modelSettings?.temperature).toBeUndefined();
    expect(result.toolChoice).toBeUndefined();
  });

  it('drops sensitive credential headers from serialized modelSettings.headers', () => {
    // Durable execution engines (e.g. Inngest) persist the serialized workflow
    // input to durable storage. Headers that frequently carry credentials must
    // never reach that storage.
    const result = serializeDurableOptions({
      modelSettings: {
        temperature: 0.5,
        headers: {
          'X-Trace-Id': 'trace-1',
          // The full set of denylisted headers — match must be case-insensitive.
          Authorization: 'Bearer sk-secret',
          'proxy-authorization': 'Basic c2VjcmV0',
          Cookie: 'session=abc',
          'Set-Cookie': 'session=abc',
          'X-Api-Key': 'sk-leaked',
          'api-key': 'sk-leaked-2',
          'x-auth-token': 'token-3',
          'X-Access-Token': 'token-4',
          'x-amz-security-token': 'amz-token',
          'X-Goog-Api-Key': 'goog-key',
          'openai-api-key': 'sk-openai',
          'anthropic-api-key': 'sk-anthropic',
        },
      } as any,
    });

    expect(result.modelSettings?.temperature).toBe(0.5);
    // Non-sensitive header is preserved.
    expect(result.modelSettings?.headers).toEqual({ 'X-Trace-Id': 'trace-1' });

    // Nothing on the serialized output should contain any of the leaked values.
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('sk-secret');
    expect(serialized).not.toContain('c2VjcmV0');
    expect(serialized).not.toContain('session=abc');
    expect(serialized).not.toContain('sk-leaked');
    expect(serialized).not.toContain('sk-leaked-2');
    expect(serialized).not.toContain('token-3');
    expect(serialized).not.toContain('token-4');
    expect(serialized).not.toContain('amz-token');
    expect(serialized).not.toContain('goog-key');
    expect(serialized).not.toContain('sk-openai');
    expect(serialized).not.toContain('sk-anthropic');
  });

  it('omits modelSettings.headers entirely when only sensitive headers are provided', () => {
    const result = serializeDurableOptions({
      modelSettings: {
        headers: {
          Authorization: 'Bearer sk-secret',
          'X-Api-Key': 'sk-leaked',
        },
      } as any,
    });

    expect(result.modelSettings?.headers).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// serializeToolMetadata
// ---------------------------------------------------------------------------

describe('serializeToolMetadata', () => {
  const baseTool = {
    description: 'A test tool',
    execute: async () => 'result',
  } as any;

  it('uses the name argument as the serialised name', () => {
    const result = serializeToolMetadata('myTool', baseTool);
    expect(result.name).toBe('myTool');
  });

  it('uses tool.id as id when available', () => {
    const tool = { ...baseTool, id: 'tool-123' };
    const result = serializeToolMetadata('myTool', tool);
    expect(result.id).toBe('tool-123');
  });

  it('falls back to name as id when tool.id is absent', () => {
    const result = serializeToolMetadata('myTool', baseTool);
    expect(result.id).toBe('myTool');
  });

  it('includes description', () => {
    const result = serializeToolMetadata('myTool', baseTool);
    expect(result.description).toBe('A test tool');
  });

  it('defaults inputSchema to { type: "object" } when no parameters', () => {
    const result = serializeToolMetadata('myTool', baseTool);
    expect(result.inputSchema).toEqual({ type: 'object' });
  });

  it('uses parameters directly when they already look like JSON Schema', () => {
    const tool = { ...baseTool, parameters: { type: 'object', properties: { q: { type: 'string' } } } };
    const result = serializeToolMetadata('myTool', tool as any);
    expect(result.inputSchema).toEqual({ type: 'object', properties: { q: { type: 'string' } } });
  });

  it('uses jsonSchema property when present (zod-converted schema)', () => {
    const tool = { ...baseTool, parameters: { jsonSchema: { type: 'object', properties: {} } } };
    const result = serializeToolMetadata('myTool', tool as any);
    expect(result.inputSchema).toEqual({ type: 'object', properties: {} });
  });
});

// ---------------------------------------------------------------------------
// serializeToolsMetadata
// ---------------------------------------------------------------------------

describe('serializeToolsMetadata', () => {
  it('maps a record of tools to an array of metadata', () => {
    const tools = {
      search: { description: 'Search tool', execute: async () => '' } as any,
      calc: { description: 'Calc tool', execute: async () => '' } as any,
    };
    const result = serializeToolsMetadata(tools);
    expect(result).toHaveLength(2);
    const names = result.map(r => r.name);
    expect(names).toContain('search');
    expect(names).toContain('calc');
  });

  it('returns empty array for empty tools record', () => {
    expect(serializeToolsMetadata({})).toEqual([]);
  });
});
