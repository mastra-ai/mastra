import type { Agent } from '@mastra/core/agent';
import { describe, it, expect, vi } from 'vitest';

import { routeTools } from './tools';
import type { AvailableAgentTool } from './types';

const available: AvailableAgentTool[] = [
  { id: 'tool_a', name: 'Tool A', type: 'tool' },
  { id: 'agent_b', name: 'Agent B', type: 'agent' },
  { id: 'workflow_c', name: 'Workflow C', type: 'workflow' },
];

function makeAgent(ids: string[]) {
  const generate = vi.fn().mockResolvedValue({ object: { ids } });
  return { agent: { generate } as unknown as Agent, generate };
}

describe('routeTools', () => {
  it('routes each agent-selected entry into the bucket matching its type', async () => {
    const { agent } = makeAgent(['tool_a', 'agent_b', 'workflow_c']);
    const result = await routeTools(
      agent,
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

  it('only routes the subset the agent selects', async () => {
    const { agent } = makeAgent(['tool_a']);
    const result = await routeTools(
      agent,
      [
        { id: 'tool_a', name: 'Tool A' },
        { id: 'agent_b', name: 'Agent B' },
      ],
      available,
    );
    expect(result).toEqual({ tools: { tool_a: true }, agents: {}, workflows: {} });
  });

  it('returns empty buckets and skips the agent when there are no entries', async () => {
    const { agent, generate } = makeAgent([]);
    await expect(routeTools(agent, [], available)).resolves.toEqual({ tools: {}, agents: {}, workflows: {} });
    expect(generate).not.toHaveBeenCalled();
  });

  it('drops entries not present in the available list before asking the agent', async () => {
    const { agent, generate } = makeAgent(['unknown']);
    const result = await routeTools(agent, [{ id: 'unknown', name: 'Unknown' }], available);
    expect(result).toEqual({ tools: {}, agents: {}, workflows: {} });
    expect(generate).not.toHaveBeenCalled();
  });

  it('skips entries with a missing or empty id', async () => {
    const { agent } = makeAgent(['tool_a']);
    const result = await routeTools(
      agent,
      [
        { id: '', name: 'Empty' },
        { id: 'tool_a', name: 'Tool A' },
      ],
      available,
    );
    expect(result).toEqual({ tools: { tool_a: true }, agents: {}, workflows: {} });
  });

  it('returns empty buckets when nothing is available to classify against', async () => {
    const { agent, generate } = makeAgent(['tool_a']);
    const result = await routeTools(agent, [{ id: 'tool_a', name: 'Tool A' }], []);
    expect(result).toEqual({ tools: {}, agents: {}, workflows: {} });
    expect(generate).not.toHaveBeenCalled();
  });

  it('ignores agent-selected ids that were not candidates', async () => {
    const { agent } = makeAgent(['tool_a', 'agent_b']);
    const result = await routeTools(agent, [{ id: 'tool_a', name: 'Tool A' }], available);
    expect(result).toEqual({ tools: { tool_a: true }, agents: {}, workflows: {} });
  });
});
