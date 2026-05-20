// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BuilderPickerVisibility } from '../../../builder';
import { useAvailableAgentTools } from '../use-available-agent-tools';

let pickerMock: BuilderPickerVisibility;

vi.mock('../../../builder', () => ({
  useBuilderPickerVisibility: () => pickerMock,
}));

const UNRESTRICTED: BuilderPickerVisibility = {
  visibleTools: null,
  visibleAgents: null,
  visibleWorkflows: null,
};

beforeEach(() => {
  pickerMock = UNRESTRICTED;
});

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

  it('builds AgentTool[] including workflows with type "workflow"', () => {
    const { result } = renderHook(() =>
      useAvailableAgentTools({
        toolsData: {},
        agentsData: {},
        workflowsData: { 'wf-1': { name: 'Workflow One', description: 'wf desc' } },
        selectedTools: {},
        selectedAgents: {},
        selectedWorkflows: { 'wf-1': true },
      }),
    );

    expect(result.current).toHaveLength(1);
    expect(result.current[0]).toMatchObject({
      id: 'wf-1',
      name: 'Workflow One',
      description: 'wf desc',
      type: 'workflow',
      isChecked: true,
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

  it('filters tools when picker tools allowlist is restricted', () => {
    pickerMock = {
      ...UNRESTRICTED,
      visibleTools: new Set(['tool-a']),
    };
    const { result } = renderHook(() =>
      useAvailableAgentTools({
        toolsData: { 'tool-a': { description: 'A' }, 'tool-b': { description: 'B' } },
        agentsData: {},
        selectedTools: {},
        selectedAgents: {},
      }),
    );
    expect(result.current).toHaveLength(1);
    expect(result.current[0].id).toBe('tool-a');
  });

  it('filters agents and workflows independently from tools', () => {
    pickerMock = {
      visibleTools: null,
      visibleAgents: new Set(['agent-x']),
      visibleWorkflows: new Set(['wf-1']),
    };
    const { result } = renderHook(() =>
      useAvailableAgentTools({
        toolsData: { 'tool-a': {} },
        agentsData: { 'agent-x': { name: 'X' }, 'agent-y': { name: 'Y' } },
        workflowsData: { 'wf-1': { name: 'WF1' }, 'wf-2': { name: 'WF2' } },
        selectedTools: {},
        selectedAgents: {},
        selectedWorkflows: {},
      }),
    );
    const ids = result.current.map(t => t.id).sort();
    expect(ids).toEqual(['agent-x', 'tool-a', 'wf-1']);
  });

  it('returns empty list when an allowlist is empty', () => {
    pickerMock = {
      ...UNRESTRICTED,
      visibleTools: new Set(),
    };
    const { result } = renderHook(() =>
      useAvailableAgentTools({
        toolsData: { 'tool-a': {}, 'tool-b': {} },
        agentsData: {},
        selectedTools: {},
        selectedAgents: {},
      }),
    );
    expect(result.current).toHaveLength(0);
  });

  it('matches allowlist against the response key (server normalizes IDs server-side)', () => {
    // Server-side, picker IDs are normalized to the response keys of each
    // GET /<kind> endpoint, so the client filter only needs to compare keys.
    pickerMock = {
      ...UNRESTRICTED,
      visibleTools: new Set(['weatherKey', 'fallback-key']),
    };
    const { result } = renderHook(() =>
      useAvailableAgentTools({
        toolsData: {
          weatherKey: { id: 'weather-id', description: 'W' },
          'fallback-key': { description: 'F' },
          otherKey: { id: 'other-id', description: 'O' },
        },
        agentsData: {},
        selectedTools: {},
        selectedAgents: {},
      }),
    );
    const ids = result.current.map(t => t.id).sort();
    expect(ids).toEqual(['fallback-key', 'weatherKey']);
  });

  it('ignores allowlist IDs not present in raw data', () => {
    pickerMock = {
      ...UNRESTRICTED,
      visibleTools: new Set(['tool-a', 'ghost']),
    };
    const { result } = renderHook(() =>
      useAvailableAgentTools({
        toolsData: { 'tool-a': {} },
        agentsData: {},
        selectedTools: {},
        selectedAgents: {},
      }),
    );
    expect(result.current).toHaveLength(1);
    expect(result.current[0].id).toBe('tool-a');
  });
});
