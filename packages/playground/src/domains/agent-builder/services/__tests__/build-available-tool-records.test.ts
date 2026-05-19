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
      {},
      'agent-self',
    );

    expect(result.agents).toEqual({
      'agent-other': { id: 'agent-other', name: 'Other', description: undefined },
    });
  });

  it('builds workflows record and falls back to id when name is missing', () => {
    const result = buildAvailableToolRecords(
      {},
      {},
      {
        'wf-1': { name: 'Workflow One', description: 'workflow desc' },
        'wf-2': {},
      },
    );

    expect(result.workflows).toEqual({
      'wf-1': { id: 'wf-1', name: 'Workflow One', description: 'workflow desc' },
      'wf-2': { id: 'wf-2', name: 'wf-2', description: undefined },
    });
  });

  it('returns tools, agents, and workflows when all three are populated', () => {
    const result = buildAvailableToolRecords(
      { 'tool-a': { description: 'Tool A' } },
      { 'agent-x': { name: 'Agent X' } },
      { 'wf-1': { name: 'Workflow One' } },
    );

    expect(result.tools).toEqual({ 'tool-a': { description: 'Tool A' } });
    expect(result.agents).toEqual({ 'agent-x': { id: 'agent-x', name: 'Agent X', description: undefined } });
    expect(result.workflows).toEqual({ 'wf-1': { id: 'wf-1', name: 'Workflow One', description: undefined } });
  });

  it('defaults workflows to an empty record when omitted', () => {
    const result = buildAvailableToolRecords({}, {});

    expect(result.workflows).toEqual({});
  });
});
