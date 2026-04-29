// @vitest-environment jsdom
import type { StoredSkillResponse } from '@mastra/client-js';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';
import type { AgentBuilderEditFormValues } from '../../../../schemas';
import type { AgentTool } from '../../../../types/agent-tool';
import type { ModelInfo } from '@/domains/llm';
import { useAgentBuilderTool } from '../use-agent-builder-tool';

vi.mock('../../../../hooks/use-builder-agent-features', () => ({
  useBuilderAgentFeatures: () => ({
    tools: true,
    memory: false,
    workflows: false,
    agents: true,
    avatarUpload: false,
    skills: true,
    model: true,
    stars: false,
  }),
}));

const features = {
  tools: true,
  memory: false,
  workflows: false,
  agents: true,
  avatarUpload: false,
  skills: true,
  model: true,
  stars: false,
};

const renderBuilderTool = (
  availableAgentTools: AgentTool[],
  options: {
    features?: typeof features;
    availableSkills?: StoredSkillResponse[];
    availableModels?: ModelInfo[];
  } = {},
) => {
  const formRef: { current: ReturnType<typeof useForm<AgentBuilderEditFormValues>> | null } = {
    current: null,
  };

  const Wrapper = ({ children }: { children: React.ReactNode }) => {
    const methods = useForm<AgentBuilderEditFormValues>({
      defaultValues: { name: '', description: '', instructions: '', tools: {}, agents: {}, skills: {} },
    });
    formRef.current = methods;
    return React.createElement(FormProvider, methods, children);
  };

  const { result } = renderHook(
    () =>
      useAgentBuilderTool({
        features: options.features ?? features,
        availableAgentTools,
        availableSkills: options.availableSkills,
        availableModels: options.availableModels,
      }),
    {
      wrapper: Wrapper,
    },
  );

  return { tool: result.current, form: () => formRef.current! };
};

const buildSkill = (id: string): StoredSkillResponse =>
  ({
    id,
    status: 'published',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    name: id,
    instructions: 'inst',
  }) as StoredSkillResponse;

describe('useAgentBuilderTool execute routing', () => {
  it('routes tool ids to form.tools and agent ids to form.agents', async () => {
    const availableAgentTools: AgentTool[] = [
      { id: 'tool-a', name: 'tool-a', isChecked: false, type: 'tool' },
      { id: 'tool-b', name: 'tool-b', isChecked: false, type: 'tool' },
      { id: 'agent-x', name: 'Agent X', isChecked: false, type: 'agent' },
    ];

    const { tool, form } = renderBuilderTool(availableAgentTools);

    await tool.execute!({
      name: 'My agent',
      description: 'desc',
      instructions: 'do things',
      tools: [
        { id: 'tool-a', name: 'Tool A' },
        { id: 'agent-x', name: 'Agent X' },
      ],
    } as any);

    expect(form().getValues('tools')).toEqual({ 'tool-a': true });
    expect(form().getValues('agents')).toEqual({ 'agent-x': true });
    expect(form().getValues('name')).toBe('My agent');
    expect(form().getValues('instructions')).toBe('do things');
  });

  it('writes empty records when no tools entries arrive', async () => {
    const { tool, form } = renderBuilderTool([{ id: 'tool-a', name: 'tool-a', isChecked: false, type: 'tool' }]);

    await tool.execute!({
      name: 'No tools',
      instructions: 'instructions',
      tools: [],
    } as any);

    expect(form().getValues('tools')).toEqual({});
    expect(form().getValues('agents')).toEqual({});
  });

  it('routes valid skill ids to form.skills and drops unknown ids', async () => {
    const availableSkills = [buildSkill('skill-a'), buildSkill('skill-b')];
    const { tool, form } = renderBuilderTool([], { availableSkills });

    await tool.execute!({
      name: 'With skills',
      instructions: 'do things',
      skills: [
        { id: 'skill-a', name: 'Skill A' },
        { id: 'unknown', name: 'Unknown' },
      ],
    } as any);

    expect(form().getValues('skills')).toEqual({ 'skill-a': true });
  });

  it('ignores skills input when the feature is off', async () => {
    const availableSkills = [buildSkill('skill-a')];
    const featuresOff = { ...features, skills: false };
    const { tool, form } = renderBuilderTool([], { features: featuresOff, availableSkills });

    await tool.execute!({
      name: 'With skills',
      instructions: 'do things',
      skills: [{ id: 'skill-a', name: 'Skill A' }],
    } as any);

    expect(form().getValues('skills')).toEqual({});
  });

  it('routes workflow ids to form.workflows', async () => {
    const availableAgentTools: AgentTool[] = [
      { id: 'tool-a', name: 'tool-a', isChecked: false, type: 'tool' },
      { id: 'wf-1', name: 'Workflow One', isChecked: false, type: 'workflow' },
    ];

    const { tool, form } = renderBuilderTool(availableAgentTools);

    await tool.execute!({
      name: 'With workflow',
      instructions: 'do things',
      tools: [
        { id: 'tool-a', name: 'Tool A' },
        { id: 'wf-1', name: 'Workflow One' },
      ],
    } as any);

    expect(form().getValues('tools')).toEqual({ 'tool-a': true });
    expect(form().getValues('workflows')).toEqual({ 'wf-1': true });
  });

  it('writes selected model to the form with a cleaned provider id', async () => {
    const { tool, form } = renderBuilderTool([], {
      availableModels: [{ provider: 'gateway/openai', providerName: 'OpenAI', model: 'gpt-4o' }],
    });

    await tool.execute!({
      name: 'With model',
      instructions: 'do things',
      model: { provider: 'gateway/openai', name: 'gpt-4o' },
    } as any);

    expect(form().getValues('model')).toEqual({ provider: 'openai', name: 'gpt-4o' });
  });
});
