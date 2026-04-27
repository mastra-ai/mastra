import { describe, expect, it } from 'vitest';
import { buildAvailableToolRecords } from '../build-available-tool-records';

describe('buildAvailableToolRecords', () => {
  it('extracts tool descriptions into the tools record', () => {
    const result = buildAvailableToolRecords(
      {
        'tool-a': { description: 'Tool A description' },
        'tool-b': { description: undefined },
      },
      {},
    );

    expect(result.tools).toEqual({
      'tool-a': { description: 'Tool A description' },
      'tool-b': { description: undefined },
    });
  });

  it('builds agents records and falls back to id when name is missing', () => {
    const result = buildAvailableToolRecords(
      {},
      {
        'agent-x': { name: 'Agent X', description: 'desc' },
        'agent-y': {},
      },
    );

    expect(result.agents).toEqual({
      'agent-x': { id: 'agent-x', name: 'Agent X', description: 'desc' },
      'agent-y': { id: 'agent-y', name: 'agent-y', description: undefined },
    });
  });

  it('excludes the agent matching excludeAgentId from the agents record', () => {
    const result = buildAvailableToolRecords(
      {},
      {
        'agent-self': { name: 'Self' },
        'agent-other': { name: 'Other' },
      },
      'agent-self',
    );

    expect(result.agents).toEqual({
      'agent-other': { id: 'agent-other', name: 'Other', description: undefined },
    });
  });
});
