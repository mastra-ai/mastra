import { describe, expect, it } from 'vitest';
import type { AgentTool } from '../../../types/agent-tool';
import { routeToolInputToFormKeys } from '../route-tool-input';

describe('routeToolInputToFormKeys', () => {
  it('routes tool ids to tools and agent ids to agents based on the available type map', () => {
    const available: AgentTool[] = [
      { id: 'tool-a', name: 'tool-a', isChecked: false, type: 'tool' },
      { id: 'agent-x', name: 'Agent X', isChecked: false, type: 'agent' },
    ];

    const result = routeToolInputToFormKeys(available, [
      { id: 'tool-a', name: 'Tool A' },
      { id: 'agent-x', name: 'Agent X' },
    ]);

    expect(result.tools).toEqual({ 'tool-a': true });
    expect(result.agents).toEqual({ 'agent-x': true });
  });

  it('returns empty records when no entries are provided', () => {
    const result = routeToolInputToFormKeys([], []);
    expect(result.tools).toEqual({});
    expect(result.agents).toEqual({});
  });

  it('treats unknown ids as tools (default routing)', () => {
    const result = routeToolInputToFormKeys([], [{ id: 'unknown', name: 'Unknown' }]);
    expect(result.tools).toEqual({ unknown: true });
    expect(result.agents).toEqual({});
  });
});
