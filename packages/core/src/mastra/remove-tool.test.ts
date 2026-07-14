import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createTool } from '../tools';
import { Mastra } from './index';

const makeTool = (id: string) =>
  createTool({
    id,
    description: 'A test tool',
    inputSchema: z.object({}),
    execute: async () => ({ result: 'ok' }),
  });

describe('Mastra.removeTool', () => {
  it('should remove a tool by key', () => {
    const testTool = makeTool('test-tool-id');

    const mastra = new Mastra({
      tools: { testTool },
    });

    expect(mastra.listTools()?.testTool).toBeDefined();

    const removed = mastra.removeTool('testTool');
    expect(removed).toBe(true);
    expect(mastra.listTools()?.testTool).toBeUndefined();
  });

  it('should return false when tool does not exist', () => {
    const mastra = new Mastra({});

    expect(mastra.removeTool('non-existent-tool')).toBe(false);
  });

  it('should allow re-adding a tool after removal', () => {
    const testTool = makeTool('reusable-tool-id');

    const mastra = new Mastra({
      tools: { myTool: testTool },
    });

    mastra.removeTool('myTool');
    expect(mastra.listTools()?.myTool).toBeUndefined();

    mastra.addTool(makeTool('reusable-tool-id'), 'myTool');
    expect(mastra.listTools()?.myTool).toBeDefined();
  });
});
