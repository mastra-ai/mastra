// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useAvailableAgentTools } from '../use-available-agent-tools';

describe('useAvailableAgentTools', () => {
  it('builds AgentTool[] from tools and agents data', () => {
    const { result } = renderHook(() =>
      useAvailableAgentTools({
        toolsData: { 'tool-a': { description: 'Tool A' } },
        agentsData: { 'agent-x': { name: 'Agent X' } },
        selectedTools: { 'tool-a': true },
        selectedAgents: {},
      }),
    );

    expect(result.current).toHaveLength(2);
    expect(result.current.find(t => t.id === 'tool-a')).toMatchObject({
      type: 'tool',
      isChecked: true,
      description: 'Tool A',
    });
    expect(result.current.find(t => t.id === 'agent-x')).toMatchObject({
      type: 'agent',
      name: 'Agent X',
      isChecked: false,
    });
  });

  it('excludes the agent matching excludeAgentId', () => {
    const { result } = renderHook(() =>
      useAvailableAgentTools({
        toolsData: {},
        agentsData: { 'agent-self': { name: 'Self' }, 'agent-other': { name: 'Other' } },
        selectedTools: {},
        selectedAgents: {},
        excludeAgentId: 'agent-self',
      }),
    );

    expect(result.current).toHaveLength(1);
    expect(result.current[0].id).toBe('agent-other');
  });

  it('returns the same reference when inputs are referentially equal across renders', () => {
    const toolsData = { 'tool-a': { description: 'Tool A' } };
    const agentsData = { 'agent-x': { name: 'Agent X' } };
    const selectedTools = { 'tool-a': true };
    const selectedAgents = {};

    const { result, rerender } = renderHook(
      ({
        tools,
        agents,
        selT,
        selA,
      }: {
        tools: Record<string, unknown>;
        agents: Record<string, unknown>;
        selT: Record<string, boolean>;
        selA: Record<string, boolean>;
      }) =>
        useAvailableAgentTools({
          toolsData: tools,
          agentsData: agents,
          selectedTools: selT,
          selectedAgents: selA,
        }),
      { initialProps: { tools: toolsData, agents: agentsData, selT: selectedTools, selA: selectedAgents } },
    );

    const first = result.current;
    rerender({ tools: toolsData, agents: agentsData, selT: selectedTools, selA: selectedAgents });

    expect(result.current).toBe(first);
  });
});
