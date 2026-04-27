import { describe, expect, it } from 'vitest';
import type { AgentTool } from '../../../types/agent-tool';
import { buildAgentBuilderToolDescription } from '../build-tool-description';

const allOff = { tools: false, skills: false, memory: false, workflows: false, agents: false };

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
});
