import { describe, expect, it } from 'vitest';
import type { AgentTool } from '../../../types/agent-tool';
import { buildAgentBuilderToolDescription } from '../build-tool-description';

const allOff = {
  tools: false,
  skills: false,
  memory: false,
  workflows: false,
  agents: false,
  avatarUpload: false,
  model: false,
  stars: false,
};

describe('buildAgentBuilderToolDescription', () => {
  it('lists name, description, instructions, and workspaceId by default', () => {
    const description = buildAgentBuilderToolDescription(allOff, [], []);

    expect(description).toContain('name');
    expect(description).toContain('description');
    expect(description).toContain('instructions');
    expect(description).toContain('workspaceId');
    expect(description).not.toContain('Available tools');
    expect(description).not.toContain('Available workspaces');
  });

  it('mentions tools and lists available tools when tools feature is on', () => {
    const tools: AgentTool[] = [
      { id: 'web-search', name: 'Web Search', description: 'Search the web', isChecked: false, type: 'tool' },
      { id: 'http-fetch', name: 'HTTP Fetch', isChecked: false, type: 'tool' },
    ];
    const description = buildAgentBuilderToolDescription({ ...allOff, tools: true }, tools, []);

    expect(description).toContain('tools');
    expect(description).toContain('web-search');
    expect(description).toContain('Search the web');
    expect(description).toContain('http-fetch');
  });

  it('mentions skills and lists available skills when skills feature is on and skills are available', () => {
    const skills = [
      {
        id: 'researcher',
        status: 'published',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        name: 'researcher',
        description: 'Research things',
        instructions: 'inst',
      },
      {
        id: 'writer',
        status: 'published',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        name: 'writer',
        instructions: 'inst',
      },
    ] as never;
    const description = buildAgentBuilderToolDescription({ ...allOff, skills: true }, [], [], skills);

    expect(description).toContain('skills');
    expect(description).toContain('Available skills');
    expect(description).toContain('researcher');
    expect(description).toContain('Research things');
    expect(description).toContain('writer');
  });

  it('mentions createSkillTool when skills feature is on', () => {
    const description = buildAgentBuilderToolDescription({ ...allOff, skills: true }, [], []);
    expect(description).toContain('createSkillTool');
  });

  it('does not mention createSkillTool when skills feature is off', () => {
    const description = buildAgentBuilderToolDescription(allOff, [], []);
    expect(description).not.toContain('createSkillTool');
  });

  it('does not mention skills when feature is off even if skills are provided', () => {
    const skills = [
      {
        id: 'researcher',
        status: 'published',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        name: 'researcher',
        instructions: 'inst',
      },
    ] as never;
    const description = buildAgentBuilderToolDescription(allOff, [], [], skills);

    expect(description).not.toContain('Available skills');
  });

  it('lists available workspaces when present', () => {
    const description = buildAgentBuilderToolDescription(
      allOff,
      [],
      [
        { id: 'ws-1', name: 'Primary' },
        { id: 'ws-2', name: 'Secondary' },
      ],
    );

    expect(description).toContain('ws-1');
    expect(description).toContain('Primary');
    expect(description).toContain('ws-2');
    expect(description).toContain('Secondary');
  });

  it('mentions model and lists available provider/model pairs when models are available', () => {
    const description = buildAgentBuilderToolDescription(
      { ...allOff, model: true },
      [],
      [],
      [],
      [
        { provider: 'openai', providerName: 'OpenAI', model: 'gpt-4o' },
        { provider: 'anthropic', providerName: 'Anthropic', model: 'claude-opus-4-7' },
      ],
    );

    expect(description).toContain('model');
    expect(description).toContain('Available models');
    expect(description).toContain('provider: openai (OpenAI), name: gpt-4o');
    expect(description).toContain('provider: anthropic (Anthropic), name: claude-opus-4-7');
  });
});
