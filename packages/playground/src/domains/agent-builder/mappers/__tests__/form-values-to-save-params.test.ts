import type { StoredSkillResponse } from '@mastra/client-js';
import { describe, expect, it } from 'vitest';
import type { AgentTool } from '../../types/agent-tool';
import { formValuesToSaveParams } from '../form-values-to-save-params';

const buildSkill = (id: string, description?: string): StoredSkillResponse => ({
  id,
  status: 'published',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  name: id,
  description,
  instructions: 'inst',
});

const baseValues = {
  name: 'My agent',
  description: '',
  instructions: 'Do things',
  tools: {},
  agents: {},
  workflows: {},
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

  it('returns empty records for tools/agents/workflows when their resolved record is empty', () => {
    const result = formValuesToSaveParams(baseValues, []);

    expect(result.tools).toEqual({});
    expect(result.agents).toEqual({});
    expect(result.workflows).toEqual({});
  });

  it('returns an empty tools record when a previously-selected tool is toggled off', () => {
    const availableAgentTools: AgentTool[] = [
      { id: 'tool-a', name: 'Tool A', description: 'Tool A desc', isChecked: false, type: 'tool' },
    ];

    const result = formValuesToSaveParams({ ...baseValues, tools: { 'tool-a': false } }, availableAgentTools);

    expect(result.tools).toEqual({});
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

  it('builds a skill entry with description when the available skill has one', () => {
    const availableSkills = [buildSkill('skill-a', 'Skill A desc')];

    const result = formValuesToSaveParams({ ...baseValues, skills: { 'skill-a': true } }, [], availableSkills);

    expect(result.skills).toEqual({ 'skill-a': { description: 'Skill A desc' } });
  });

  it('builds a skill entry with an empty record when the available skill has no description', () => {
    const availableSkills = [buildSkill('skill-a')];

    const result = formValuesToSaveParams({ ...baseValues, skills: { 'skill-a': true } }, [], availableSkills);

    expect(result.skills).toEqual({ 'skill-a': {} });
  });

  it('returns an empty skills record when nothing is selected', () => {
    const result = formValuesToSaveParams(baseValues, [], [buildSkill('skill-a', 'Skill A desc')]);

    expect(result.skills).toEqual({});
  });

  it('omits disabled skills from the resulting record', () => {
    const availableSkills = [buildSkill('skill-a'), buildSkill('skill-b')];

    const result = formValuesToSaveParams(
      { ...baseValues, skills: { 'skill-a': true, 'skill-b': false } },
      [],
      availableSkills,
    );

    expect(result.skills).toEqual({ 'skill-a': {} });
  });
});
