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
    expect(result.workflows).toEqual({});
  });

  it('routes workflow ids into the workflows bucket', () => {
    const available: AgentTool[] = [{ id: 'wf-1', name: 'Workflow', isChecked: false, type: 'workflow' }];

    const result = routeToolInputToFormKeys(available, [{ id: 'wf-1', name: 'Workflow' }]);

    expect(result.workflows).toEqual({ 'wf-1': true });
    expect(result.tools).toEqual({});
    expect(result.agents).toEqual({});
  });

  it('routes mixed input across tools, agents, and workflows correctly', () => {
    const available: AgentTool[] = [
      { id: 'tool-a', name: 'tool-a', isChecked: false, type: 'tool' },
      { id: 'agent-x', name: 'Agent X', isChecked: false, type: 'agent' },
      { id: 'wf-1', name: 'Workflow One', isChecked: false, type: 'workflow' },
    ];

    const result = routeToolInputToFormKeys(available, [
      { id: 'tool-a', name: 'Tool A' },
      { id: 'agent-x', name: 'Agent X' },
      { id: 'wf-1', name: 'Workflow One' },
    ]);

    expect(result.tools).toEqual({ 'tool-a': true });
    expect(result.agents).toEqual({ 'agent-x': true });
    expect(result.workflows).toEqual({ 'wf-1': true });
  });

  it('returns empty records when no entries are provided', () => {
    const result = routeToolInputToFormKeys([], []);
    expect(result.tools).toEqual({});
    expect(result.agents).toEqual({});
    expect(result.workflows).toEqual({});
  });

  it('drops ids that are not present in the available list (e.g. when a feature is gated off)', () => {
    const result = routeToolInputToFormKeys([], [{ id: 'unknown', name: 'Unknown' }]);
    expect(result.tools).toEqual({});
    expect(result.agents).toEqual({});
    expect(result.workflows).toEqual({});
  });

  it('drops agent/workflow ids when the available list only exposes tools (gated features)', () => {
    const available: AgentTool[] = [{ id: 'tool-a', name: 'tool-a', isChecked: false, type: 'tool' }];

    const result = routeToolInputToFormKeys(available, [
      { id: 'tool-a', name: 'Tool A' },
      { id: 'agent-x', name: 'Agent X' },
      { id: 'wf-1', name: 'Workflow' },
    ]);

    expect(result.tools).toEqual({ 'tool-a': true });
    expect(result.agents).toEqual({});
    expect(result.workflows).toEqual({});
  });

  it('routes integration ids into integrationTools with providerId/toolService/slug/description', () => {
    const available: AgentTool[] = [
      {
        id: 'integration:composio:GMAIL_FETCH_EMAILS',
        name: 'GMAIL_FETCH_EMAILS',
        description: 'Fetch emails',
        isChecked: true,
        type: 'integration',
        providerId: 'composio',
        toolService: 'gmail',
      },
    ];

    const result = routeToolInputToFormKeys(available, [
      { id: 'integration:composio:GMAIL_FETCH_EMAILS', name: 'Fetch Emails' },
    ]);

    expect(result.tools).toEqual({});
    expect(result.agents).toEqual({});
    expect(result.workflows).toEqual({});
    expect(result.integrationTools).toEqual([
      {
        providerId: 'composio',
        toolService: 'gmail',
        slug: 'GMAIL_FETCH_EMAILS',
        description: 'Fetch emails',
      },
    ]);
  });

  it('skips integration entries missing providerId or toolService (defensive)', () => {
    const available: AgentTool[] = [
      {
        id: 'integration:composio:BROKEN',
        name: 'BROKEN',
        isChecked: true,
        type: 'integration',
        // providerId missing
        toolService: 'gmail',
      },
    ];

    const result = routeToolInputToFormKeys(available, [{ id: 'integration:composio:BROKEN', name: 'Broken' }]);
    expect(result.integrationTools).toEqual([]);
  });

  it('returns an empty integrationTools array by default', () => {
    const result = routeToolInputToFormKeys([], []);
    expect(result.integrationTools).toEqual([]);
  });
});
