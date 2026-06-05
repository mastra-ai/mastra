import { describe, it, expect } from 'vitest';
import { routeTools } from './tools';
import type { AvailableAgentTool } from './types';

const available: AvailableAgentTool[] = [
  { id: 'tool_a', name: 'Tool A', type: 'tool' },
  { id: 'agent_b', name: 'Agent B', type: 'agent' },
  { id: 'workflow_c', name: 'Workflow C', type: 'workflow' },
];

describe('routeTools', () => {
  it('routes each entry into the bucket matching its available type', () => {
    const result = routeTools(
      [
        { id: 'tool_a', name: 'Tool A' },
        { id: 'agent_b', name: 'Agent B' },
        { id: 'workflow_c', name: 'Workflow C' },
      ],
      available,
    );
    expect(result).toEqual({
      tools: { tool_a: true },
      agents: { agent_b: true },
      workflows: { workflow_c: true },
    });
  });

  it('returns empty buckets when there are no entries', () => {
    expect(routeTools([], available)).toEqual({ tools: {}, agents: {}, workflows: {} });
  });

  it('skips entries whose id is not in the available list', () => {
    const result = routeTools([{ id: 'unknown', name: 'Unknown' }], available);
    expect(result).toEqual({ tools: {}, agents: {}, workflows: {} });
  });

  it('skips entries with a missing or empty id', () => {
    const result = routeTools(
      [
        { id: '', name: 'Empty' },
        { id: 'tool_a', name: 'Tool A' },
      ],
      available,
    );
    expect(result).toEqual({ tools: { tool_a: true }, agents: {}, workflows: {} });
  });

  it('routes multiple entries of the same type', () => {
    const result = routeTools(
      [
        { id: 'tool_a', name: 'Tool A' },
        { id: 'tool_d', name: 'Tool D' },
      ],
      [...available, { id: 'tool_d', name: 'Tool D', type: 'tool' }],
    );
    expect(result.tools).toEqual({ tool_a: true, tool_d: true });
  });

  it('returns empty buckets when nothing is available to classify against', () => {
    const result = routeTools([{ id: 'tool_a', name: 'Tool A' }], []);
    expect(result).toEqual({ tools: {}, agents: {}, workflows: {} });
  });

  it('de-duplicates repeated ids into a single true entry', () => {
    const result = routeTools(
      [
        { id: 'tool_a', name: 'Tool A' },
        { id: 'tool_a', name: 'Tool A again' },
      ],
      available,
    );
    expect(result.tools).toEqual({ tool_a: true });
  });
});
