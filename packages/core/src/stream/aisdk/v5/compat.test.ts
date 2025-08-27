import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { prepareToolsAndToolChoice } from './compat';

describe('prepareToolsAndToolChoice error handling', () => {
  it('does not throw if a tool throws during preparation', () => {
    // Arrange: Create a tool that will throw during preparation
    const throwingTool = {
      id: 'throwing-tool',
      name: 'throwingTool',
      description: 'A tool that throws',
      // Invalid schema that will cause asSchema() to throw
      inputSchema: (() => {
        const schema: any = z.object({});
        schema._def.shape = () => schema; // Create circular reference
        return schema;
      })(),
    };

    const tools = { throwingTool };

    // Act: Call function with throwing tool
    const result = prepareToolsAndToolChoice({
      tools,
      toolChoice: undefined,
      activeTools: undefined,
    });

    // Assert: Function completes and returns valid response
    expect(result).toBeDefined();
    expect(result.tools).toBeDefined();
    expect(result.toolChoice).toEqual({ type: 'auto' });
  });

  it('excludes tools that throw during preparation', () => {
    // Arrange: Create valid and throwing tools
    const throwingTool = {
      id: 'throwing-tool',
      name: 'throwingTool',
      description: 'A tool that throws',
      // Invalid schema that will cause asSchema() to throw
      inputSchema: (() => {
        const schema: any = z.object({});
        schema._def.shape = () => schema; // Create circular reference
        return schema;
      })(),
    };

    const validTool = {
      id: 'valid-tool',
      name: 'validTool',
      description: 'A valid tool',
      inputSchema: z.object({ param: z.string() }),
    };

    const tools = { throwingTool, validTool };

    // Act: Call function with both tools
    const result = prepareToolsAndToolChoice({
      tools,
      toolChoice: undefined,
      activeTools: undefined,
    });

    // Assert: Only valid tool remains, throwing tool filtered out
    expect(result.tools).toHaveLength(1);
    expect(result.tools?.[0].name).toBe('validTool');
  });
});
