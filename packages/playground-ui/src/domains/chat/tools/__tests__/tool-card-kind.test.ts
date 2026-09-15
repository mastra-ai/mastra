import { describe, expect, it } from 'vitest';

import type { MessageMetadata } from '../../messages/message-metadata';
import type { ToolPartFields } from '../../messages/renderers/tool-part';
import { badgeStatus, toolCardKind, toolInteraction } from '../tool-card-kind';
import { WORKSPACE_TOOLS } from '../workspace-tool-constants';

const fields = (toolName: string, extra: Partial<ToolPartFields> = {}): ToolPartFields => ({
  toolName,
  toolCallId: 'call-1',
  input: {},
  output: undefined,
  ...extra,
});

const network = (from: string): MessageMetadata => ({ mode: 'network', from });

const approval = (toolCallId: string) => ({ toolCallId, toolName: 'view', args: {} });

describe('toolCardKind', () => {
  describe('when the tool draws nothing on its own', () => {
    it('marks the observation marker', () => {
      expect(toolCardKind(fields('mastra-memory-om-observation'), {})).toBe('observation');
    });

    it('hides working memory updates and task tools', () => {
      expect(toolCardKind(fields('updateWorkingMemory'), {})).toBe('hidden');
      expect(toolCardKind(fields('task_write'), {})).toBe('hidden');
    });
  });

  describe('when the tool waits on the reader', () => {
    it('keeps a question as ask_user even once answered', () => {
      expect(toolCardKind(fields('ask_user', { output: { answer: 'yes' } }), {})).toBe('ask_user');
    });

    it('detects submit_plan by tool name', () => {
      expect(toolCardKind(fields('submit_plan'), {})).toBe('submit_plan');
    });

    it('detects submit_plan from the suspend payload of an aliased tool', () => {
      const metadata: MessageMetadata = {
        suspendedTools: { 'call-1': { suspendPayload: { toolId: 'submit_plan' } } },
      };
      expect(toolCardKind(fields('plan'), { metadata })).toBe('submit_plan');
    });

    it('detects submit_plan from the output of an aliased tool', () => {
      expect(toolCardKind(fields('plan', { output: { toolId: 'submit_plan' } }), {})).toBe('submit_plan');
    });
  });

  describe('when the call delegates to another runtime', () => {
    it('flags a background task from its output text', () => {
      expect(toolCardKind(fields('run', { output: 'Started Background Task #3' }), {})).toBe('background');
    });

    it('detects an agent by name prefix or network origin', () => {
      expect(toolCardKind(fields('agent-writer'), {})).toBe('agent');
      expect(toolCardKind(fields('writer'), { metadata: network('AGENT') })).toBe('agent');
    });

    it('detects a workflow by name prefix or network origin', () => {
      expect(toolCardKind(fields('workflow-deploy'), {})).toBe('workflow');
      expect(toolCardKind(fields('deploy'), { metadata: network('WORKFLOW') })).toBe('workflow');
    });
  });

  describe('when the call is a workspace tool', () => {
    it('draws list_files as a file tree', () => {
      expect(toolCardKind(fields(WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES), {})).toBe('file_tree');
    });

    it('draws the three sandbox tools as sandbox', () => {
      for (const name of Object.values(WORKSPACE_TOOLS.SANDBOX)) {
        expect(toolCardKind(fields(name), {})).toBe('sandbox');
      }
    });
  });

  describe('when the call is recognised by shape or registry', () => {
    it('draws a Code Mode program', () => {
      expect(toolCardKind(fields('run', { input: { code: 'return 1;' } }), {})).toBe('code_mode');
    });

    it('draws an MCP app result when the tool is a registered app', () => {
      expect(toolCardKind(fields('app'), { mcpAppTools: { app: {} } })).toBe('mcp_app');
    });

    it('falls back to plain', () => {
      expect(toolCardKind(fields('view'), {})).toBe('plain');
    });
  });
});

describe('badgeStatus', () => {
  it('reports an error state regardless of the run', () => {
    expect(badgeStatus('output-error', true)).toBe('error');
  });

  it('reads settled calls and stale history as idle', () => {
    expect(badgeStatus('output-available', true)).toBe('idle');
    expect(badgeStatus('result', true)).toBe('idle');
    expect(badgeStatus('input-available', false)).toBe('idle');
  });

  it('reads an unsettled call carried by a live run as running', () => {
    expect(badgeStatus('input-available', true)).toBe('running');
  });
});

describe('toolInteraction', () => {
  describe('when metadata keys by tool name', () => {
    it('returns the approval and suspension for that name', () => {
      const metadata: MessageMetadata = {
        requireApprovalMetadata: { view: approval('x') },
        suspendedTools: { view: { suspendPayload: { q: 1 } } },
      };
      expect(toolInteraction(metadata, 'view', 'call-1')).toEqual({
        approval: approval('x'),
        suspended: { suspendPayload: { q: 1 } },
      });
    });
  });

  describe('when metadata keys by call id', () => {
    it('falls back to the call id', () => {
      const metadata: MessageMetadata = {
        requireApprovalMetadata: { 'call-1': approval('call-1') },
        suspendedTools: { 'call-1': { suspendPayload: {} } },
      };
      expect(toolInteraction(metadata, 'view', 'call-1')).toEqual({
        approval: approval('call-1'),
        suspended: { suspendPayload: {} },
      });
    });
  });

  describe('when there is no metadata', () => {
    it('returns nothing', () => {
      expect(toolInteraction(undefined, 'view', 'call-1')).toEqual({ approval: undefined, suspended: undefined });
    });
  });
});
