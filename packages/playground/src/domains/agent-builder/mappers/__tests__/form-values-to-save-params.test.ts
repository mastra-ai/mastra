import { describe, expect, it } from 'vitest';
import type { AgentTool } from '../../types/agent-tool';
import { formValuesToSaveParams } from '../form-values-to-save-params';

const baseValues = {
  name: 'My agent',
  description: '',
  instructions: 'Do things',
  tools: {},
  agents: {},
  workflows: {},
  skills: [],
};

describe('formValuesToSaveParams', () => {
  it('builds a tool entry with description when the available tool has one', () => {
    const availableAgentTools: AgentTool[] = [
      { id: 'tool-a', name: 'tool-a', description: 'Tool A desc', isChecked: true, type: 'tool' },
    ];

    const result = formValuesToSaveParams({ ...baseValues, tools: { 'tool-a': true } }, availableAgentTools);

    expect(result.tools).toEqual({ 'tool-a': { description: 'Tool A desc' } });
  });

  it('builds a tool entry with an empty record when the available tool has no description', () => {
    const availableAgentTools: AgentTool[] = [{ id: 'tool-a', name: 'tool-a', isChecked: true, type: 'tool' }];

    const result = formValuesToSaveParams({ ...baseValues, tools: { 'tool-a': true } }, availableAgentTools);

    expect(result.tools).toEqual({ 'tool-a': {} });
  });

  it('omits disabled tools from the resulting record', () => {
    const availableAgentTools: AgentTool[] = [
      { id: 'tool-a', name: 'tool-a', isChecked: true, type: 'tool' },
      { id: 'tool-b', name: 'tool-b', isChecked: false, type: 'tool' },
    ];

    const result = formValuesToSaveParams(
      { ...baseValues, tools: { 'tool-a': true, 'tool-b': false } },
      availableAgentTools,
    );

    expect(result.tools).toEqual({ 'tool-a': {} });
  });

  it('routes agent ids the same way and uses agent descriptions', () => {
    const availableAgentTools: AgentTool[] = [
      { id: 'agent-x', name: 'Agent X', description: 'Agent X desc', isChecked: true, type: 'agent' },
    ];

    const result = formValuesToSaveParams({ ...baseValues, agents: { 'agent-x': true } }, availableAgentTools);

    expect(result.agents).toEqual({ 'agent-x': { description: 'Agent X desc' } });
  });

  it('returns undefined for tools/agents/workflows/skills when their resolved record is empty', () => {
    const result = formValuesToSaveParams(baseValues, []);

    expect(result.tools).toBeUndefined();
    expect(result.agents).toBeUndefined();
    expect(result.workflows).toBeUndefined();
    expect(result.skills).toBeUndefined();
  });

  it('builds a workflow entry with description when the available workflow has one', () => {
    const availableAgentTools: AgentTool[] = [
      { id: 'wf-1', name: 'Workflow One', description: 'Workflow desc', isChecked: true, type: 'workflow' },
    ];

    const result = formValuesToSaveParams({ ...baseValues, workflows: { 'wf-1': true } }, availableAgentTools);

    expect(result.workflows).toEqual({ 'wf-1': { description: 'Workflow desc' } });
  });

  it('builds a workflow entry with an empty record when the available workflow has no description', () => {
    const availableAgentTools: AgentTool[] = [{ id: 'wf-1', name: 'Workflow One', isChecked: true, type: 'workflow' }];

    const result = formValuesToSaveParams({ ...baseValues, workflows: { 'wf-1': true } }, availableAgentTools);

    expect(result.workflows).toEqual({ 'wf-1': {} });
  });

  it('omits disabled workflows from the resulting record', () => {
    const availableAgentTools: AgentTool[] = [
      { id: 'wf-1', name: 'Workflow One', isChecked: true, type: 'workflow' },
      { id: 'wf-2', name: 'Workflow Two', isChecked: false, type: 'workflow' },
    ];

    const result = formValuesToSaveParams(
      { ...baseValues, workflows: { 'wf-1': true, 'wf-2': false } },
      availableAgentTools,
    );

    expect(result.workflows).toEqual({ 'wf-1': {} });
  });

  it('builds the skills record as `Record<string, {}>` when entries are present', () => {
    const result = formValuesToSaveParams({ ...baseValues, skills: ['summarize', 'plan'] }, []);

    expect(result.skills).toEqual({ summarize: {}, plan: {} });
  });

  it('returns undefined workspace when workspaceId is missing or empty', () => {
    expect(formValuesToSaveParams({ ...baseValues, workspaceId: undefined }, []).workspace).toBeUndefined();
    expect(formValuesToSaveParams({ ...baseValues, workspaceId: '' }, []).workspace).toBeUndefined();
  });

  it('returns an "id" workspace ref when workspaceId is set', () => {
    const result = formValuesToSaveParams({ ...baseValues, workspaceId: 'ws-1' }, []);

    expect(result.workspace).toEqual({ type: 'id', workspaceId: 'ws-1' });
  });

  it('returns undefined description when the input is empty or whitespace only', () => {
    expect(formValuesToSaveParams({ ...baseValues, description: '' }, []).description).toBeUndefined();
    expect(formValuesToSaveParams({ ...baseValues, description: '   ' }, []).description).toBeUndefined();
  });

  it('trims and returns description when the input has content', () => {
    const result = formValuesToSaveParams({ ...baseValues, description: '  Hello  ' }, []);

    expect(result.description).toBe('Hello');
  });
});
