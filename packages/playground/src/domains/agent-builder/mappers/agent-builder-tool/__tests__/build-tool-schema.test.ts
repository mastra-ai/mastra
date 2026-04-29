import { describe, expect, it } from 'vitest';
import type { AgentTool } from '../../../types/agent-tool';
import { buildAgentBuilderToolSchema } from '../build-tool-schema';

const allOff = {
  tools: false,
  memory: false,
  workflows: false,
  agents: false,
  avatarUpload: false,
  skills: false,
  model: false,
  stars: false,
};
const allOn = { ...allOff, tools: true };

describe('buildAgentBuilderToolSchema', () => {
  it('exposes name and instructions as required and omits tools when its flag is off', () => {
    const schema = buildAgentBuilderToolSchema(allOff, [], []);
    const shape = schema.shape;

    expect(shape.name).toBeDefined();
    expect(shape.instructions).toBeDefined();
    expect(shape.tools).toBeUndefined();
  });

  it('adds tools shape entry when the flag is on', () => {
    const schema = buildAgentBuilderToolSchema(allOn, [], []);
    const shape = schema.shape;

    expect(shape.tools).toBeDefined();
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

  it('exposes the skills field only when feature is on and there is at least one skill', () => {
    const skill = {
      id: 'skill-a',
      status: 'published',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      name: 'skill-a',
      instructions: 'inst',
    } as never;

    const offShape = buildAgentBuilderToolSchema(allOff, [], [], [skill]).shape;
    expect(offShape.skills).toBeUndefined();

    const onNoSkills = buildAgentBuilderToolSchema({ ...allOff, skills: true }, [], [], []).shape;
    expect(onNoSkills.skills).toBeUndefined();

    const schema = buildAgentBuilderToolSchema({ ...allOff, skills: true }, [], [], [skill]);
    expect(schema.shape.skills).toBeDefined();

    expect(
      schema.safeParse({
        name: 'N',
        instructions: 'I',
        skills: [{ id: 'skill-a', name: 'Skill A' }],
      }).success,
    ).toBe(true);

    expect(
      schema.safeParse({
        name: 'N',
        instructions: 'I',
        skills: [{ id: 'unknown', name: 'Unknown' }],
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

  it('exposes model only when available models exist and constrains exact provider/model pairs', () => {
    const emptySchema = buildAgentBuilderToolSchema(allOff, [], []);
    expect(emptySchema.shape.model).toBeUndefined();

    const schema = buildAgentBuilderToolSchema({ ...allOff, model: true }, [], [], [], [
      { provider: 'openai', providerName: 'OpenAI', model: 'gpt-4o' },
      { provider: 'anthropic', providerName: 'Anthropic', model: 'claude-opus-4-7' },
    ]);

    expect(schema.shape.model).toBeDefined();
    expect(schema.safeParse({ name: 'N', instructions: 'I', model: { provider: 'openai', name: 'gpt-4o' } }).success).toBe(
      true,
    );
    expect(
      schema.safeParse({ name: 'N', instructions: 'I', model: { provider: 'openai', name: 'claude-opus-4-7' } })
        .success,
    ).toBe(false);
    expect(schema.safeParse({ name: 'N', instructions: 'I', model: { provider: 'openai', name: 'unknown' } }).success).toBe(
      false,
    );
  });
});
