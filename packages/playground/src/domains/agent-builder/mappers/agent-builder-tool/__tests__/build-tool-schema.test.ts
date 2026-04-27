import { describe, expect, it } from 'vitest';
import type { AgentTool } from '../../../types/agent-tool';
import { buildAgentBuilderToolSchema } from '../build-tool-schema';

const allOff = { tools: false, skills: false, memory: false, workflows: false, agents: false };
const allOn = { tools: true, skills: true, memory: false, workflows: false, agents: false };

describe('buildAgentBuilderToolSchema', () => {
  it('exposes name and instructions as required and omits tools/skills when their flags are off', () => {
    const schema = buildAgentBuilderToolSchema(allOff, [], []);
    const shape = schema.shape;

    expect(shape.name).toBeDefined();
    expect(shape.instructions).toBeDefined();
    expect(shape.tools).toBeUndefined();
    expect(shape.skills).toBeUndefined();
  });

  it('adds tools and skills shape entries when the flags are on', () => {
    const schema = buildAgentBuilderToolSchema(allOn, [], []);
    const shape = schema.shape;

    expect(shape.tools).toBeDefined();
    expect(shape.skills).toBeDefined();
  });

  it('constrains tool ids to the provided ids when available', () => {
    const tools: AgentTool[] = [{ id: 'web-search', name: 'Web Search', isChecked: false, type: 'tool' }];
    const schema = buildAgentBuilderToolSchema({ ...allOff, tools: true }, tools, []);

    expect(
      schema.safeParse({
        name: 'N',
        instructions: 'I',
        tools: [{ id: 'web-search', name: 'Web Search' }],
      }).success,
    ).toBe(true);

    expect(
      schema.safeParse({
        name: 'N',
        instructions: 'I',
        tools: [{ id: 'unknown', name: 'Unknown' }],
      }).success,
    ).toBe(false);
  });

  it('always exposes an optional workspaceId and constrains it when workspaces are provided', () => {
    const schema = buildAgentBuilderToolSchema(allOff, [], [{ id: 'ws-1', name: 'Primary' }]);
    expect(schema.shape.workspaceId).toBeDefined();

    expect(schema.safeParse({ name: 'N', instructions: 'I', workspaceId: 'ws-1' }).success).toBe(true);
    expect(schema.safeParse({ name: 'N', instructions: 'I', workspaceId: 'unknown' }).success).toBe(false);
    expect(schema.safeParse({ name: 'N', instructions: 'I' }).success).toBe(true);
  });
});
