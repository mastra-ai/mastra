import { describe, it, expect } from 'vitest';
import { cleanToolsForObservability, deepClean } from './serialization';

describe('cleanToolsForObservability', () => {
  it('should return undefined for undefined input', () => {
    expect(cleanToolsForObservability(undefined)).toBeUndefined();
  });

  it('should return undefined for null input', () => {
    expect(cleanToolsForObservability(null as any)).toBeUndefined();
  });

  it('should return undefined for empty object', () => {
    expect(cleanToolsForObservability({})).toBeUndefined();
  });

  it('should extract essential fields from a simple tool', () => {
    const tools = {
      myTool: {
        type: 'function',
        id: 'my-tool-id',
        description: 'A simple tool',
        parameters: {
          jsonSchema: {
            type: 'object',
            properties: { name: { type: 'string' } },
          },
          validate: () => {},
        },
        outputSchema: {
          jsonSchema: {
            type: 'string',
          },
          validate: () => {},
        },
        execute: () => {},
        someInternalField: 'should be stripped',
      },
    };

    const result = cleanToolsForObservability(tools);

    expect(result).toEqual({
      myTool: {
        type: 'function',
        id: 'my-tool-id',
        description: 'A simple tool',
        inputSchema: {
          type: 'object',
          properties: { name: { type: 'string' } },
        },
        outputSchema: {
          type: 'string',
        },
      },
    });
  });

  it('should not include id if it matches the tool name', () => {
    const tools = {
      myTool: {
        type: 'function',
        id: 'myTool',
        description: 'A tool',
      },
    };

    const result = cleanToolsForObservability(tools);

    expect(result).toEqual({
      myTool: {
        type: 'function',
        description: 'A tool',
      },
    });
  });

  it('should default type to function if not specified', () => {
    const tools = {
      myTool: {
        description: 'A tool without type',
      },
    };

    const result = cleanToolsForObservability(tools);

    expect(result).toEqual({
      myTool: {
        type: 'function',
        description: 'A tool without type',
      },
    });
  });

  it('should handle Zod schemas by extracting typeName', () => {
    const tools = {
      zodTool: {
        type: 'function',
        description: 'A tool with Zod schema',
        parameters: {
          _def: {
            typeName: 'ZodObject',
            shape: () => {},
          },
          parse: () => {},
          safeParse: () => {},
        },
      },
    };

    const result = cleanToolsForObservability(tools);

    expect(result).toEqual({
      zodTool: {
        type: 'function',
        description: 'A tool with Zod schema',
        inputSchema: {
          _zodType: 'ZodObject',
        },
      },
    });
  });

  it('should handle raw JSON schemas (with type property)', () => {
    const tools = {
      rawSchemaTool: {
        type: 'function',
        description: 'A tool with raw JSON schema',
        parameters: {
          type: 'object',
          properties: { value: { type: 'number' } },
        },
      },
    };

    const result = cleanToolsForObservability(tools);

    expect(result).toEqual({
      rawSchemaTool: {
        type: 'function',
        description: 'A tool with raw JSON schema',
        inputSchema: {
          type: 'object',
          properties: { value: { type: 'number' } },
        },
      },
    });
  });

  it('should handle multiple tools', () => {
    const tools = {
      tool1: {
        type: 'function',
        description: 'First tool',
      },
      tool2: {
        type: 'function',
        id: 'different-id',
        description: 'Second tool',
      },
    };

    const result = cleanToolsForObservability(tools);

    expect(result).toEqual({
      tool1: {
        type: 'function',
        description: 'First tool',
      },
      tool2: {
        type: 'function',
        id: 'different-id',
        description: 'Second tool',
      },
    });
  });

  it('should skip non-object tool values', () => {
    const tools = {
      validTool: {
        type: 'function',
        description: 'A valid tool',
      },
      invalidTool: null,
      anotherInvalid: 'string',
    };

    const result = cleanToolsForObservability(tools as any);

    expect(result).toEqual({
      validTool: {
        type: 'function',
        description: 'A valid tool',
      },
    });
  });
});

describe('deepClean', () => {
  it('should handle functions by replacing with [Function]', () => {
    const obj = {
      name: 'test',
      execute: () => {},
    };

    const result = deepClean(obj);

    expect(result).toEqual({
      name: 'test',
      execute: '[Function]',
    });
  });

  it('should truncate long strings', () => {
    const longString = 'a'.repeat(2000);
    const result = deepClean(longString);

    expect(result.length).toBeLessThan(2000);
    expect(result).toContain('[truncated]');
  });

  it('should handle max depth', () => {
    // Default maxDepth is 6, so level 7 should be truncated
    const deepObject = {
      level1: {
        level2: {
          level3: {
            level4: {
              level5: {
                level6: {
                  level7: 'too deep',
                },
              },
            },
          },
        },
      },
    };

    const result = deepClean(deepObject);

    // At depth 6 (level6), the value is still an object but its children are truncated
    expect(result.level1.level2.level3.level4.level5.level6.level7).toBe('[MaxDepth]');
  });
});
