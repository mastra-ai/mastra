import { describe, expect, it } from 'vitest';
import type { AgentTool } from '../../types/agent-tool';
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
  describe('integration rows', () => {
    const gmailSend: AgentTool = {
      id: 'composio:GMAIL_SEND_EMAIL',
      name: 'GMAIL_SEND_EMAIL',
      isChecked: false,
      type: 'integration',
      providerId: 'composio',
      toolkit: 'gmail',
    };

    it('routes an integration into its provider bucket, keyed by slug', () => {
      const result = routeToolInputToFormKeys([gmailSend], [{ id: gmailSend.id, name: 'Send Email' }]);

      expect(result.toolProvidersFragment).toEqual({
        composio: { GMAIL_SEND_EMAIL: { toolkit: 'gmail' } },
      });
      expect(result.tools).toEqual({});
    });

    it('carries the row description into the fragment when there is one', () => {
      const result = routeToolInputToFormKeys(
        [{ ...gmailSend, description: 'Sends an email' }],
        [{ id: gmailSend.id, name: 'Send Email' }],
      );

      expect(result.toolProvidersFragment.composio?.GMAIL_SEND_EMAIL).toEqual({
        toolkit: 'gmail',
        description: 'Sends an email',
      });
    });

    it('collects several tools from the same provider into one bucket', () => {
      const gmailRead: AgentTool = { ...gmailSend, id: 'composio:GMAIL_READ', name: 'GMAIL_READ' };

      const result = routeToolInputToFormKeys(
        [gmailSend, gmailRead],
        [
          { id: gmailSend.id, name: 'Send Email' },
          { id: gmailRead.id, name: 'Read Email' },
        ],
      );

      expect(Object.keys(result.toolProvidersFragment.composio ?? {})).toEqual(['GMAIL_SEND_EMAIL', 'GMAIL_READ']);
    });

    it('keeps providers apart', () => {
      const other: AgentTool = {
        id: 'zapier:SEND',
        name: 'SEND',
        isChecked: false,
        type: 'integration',
        providerId: 'zapier',
        toolkit: 'email',
      };

      const result = routeToolInputToFormKeys(
        [gmailSend, other],
        [
          { id: gmailSend.id, name: 'Send Email' },
          { id: other.id, name: 'Send' },
        ],
      );

      expect(Object.keys(result.toolProvidersFragment)).toEqual(['composio', 'zapier']);
    });

    it('drops an integration row that names no provider', () => {
      const result = routeToolInputToFormKeys(
        [{ ...gmailSend, providerId: undefined }],
        [{ id: gmailSend.id, name: 'Send Email' }],
      );

      expect(result.toolProvidersFragment).toEqual({});
    });

    it('drops an integration row that names no toolkit', () => {
      const result = routeToolInputToFormKeys(
        [{ ...gmailSend, toolkit: undefined }],
        [{ id: gmailSend.id, name: 'Send Email' }],
      );

      expect(result.toolProvidersFragment).toEqual({});
    });

    it('drops a row whose type is not one the router knows', () => {
      const result = routeToolInputToFormKeys(
        [{ ...gmailSend, type: 'something-else' as never }],
        [{ id: gmailSend.id, name: 'Send Email' }],
      );

      expect(result.toolProvidersFragment).toEqual({});
      expect(result.tools).toEqual({});
    });

    it('reports an empty fragment when nothing routes to a provider', () => {
      const result = routeToolInputToFormKeys(
        [{ id: 'tool-a', name: 'tool-a', isChecked: false, type: 'tool' }],
        [{ id: 'tool-a', name: 'Tool A' }],
      );

      expect(result.toolProvidersFragment).toEqual({});
    });
  });
});
