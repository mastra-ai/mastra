// @vitest-environment jsdom
import type { StoredSkillResponse } from '@mastra/client-js';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';
import type { AgentBuilderEditFormValues } from '../../schemas';
import type { AgentTool } from '../../types/agent-tool';
import { useAgentBuilderTool } from '../use-agent-builder-tool';
import type { ModelInfo } from '@/domains/llm';

vi.mock('../use-builder-agent-features', () => ({
  useBuilderAgentFeatures: () => ({
    tools: true,
    memory: false,
    workflows: false,
    agents: true,
    avatarUpload: false,
    skills: true,
    model: true,
    favorites: false,
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
  favorites: false,
  browser: false,
};

const renderBuilderTool = (
  availableAgentTools: AgentTool[],
  options: {
    features?: typeof features;
    availableSkills?: StoredSkillResponse[];
    availableModels?: ModelInfo[];
    integrationToolsLoading?: boolean;
    defaultValues?: Partial<AgentBuilderEditFormValues>;
  } = {},
) => {
  const formRef: { current: ReturnType<typeof useForm<AgentBuilderEditFormValues>> | null } = {
    current: null,
  };

  const Wrapper = ({ children }: { children: React.ReactNode }) => {
    const methods = useForm<AgentBuilderEditFormValues>({
      defaultValues: {
        name: '',
        description: '',
        instructions: '',
        tools: {},
        agents: {},
        skills: {},
        ...options.defaultValues,
      },
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
        integrationToolsLoading: options.integrationToolsLoading,
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

  it('routes integration tool ids into form.toolProviders, preserving existing connections', async () => {
    const availableAgentTools: AgentTool[] = [
      {
        id: 'composio:GMAIL_FETCH_EMAILS',
        name: 'GMAIL_FETCH_EMAILS',
        description: 'Fetch Gmail emails',
        isChecked: false,
        type: 'integration',
        providerId: 'composio',
        toolkit: 'gmail',
      },
    ];

    const { tool, form } = renderBuilderTool(availableAgentTools, {
      defaultValues: {
        toolProviders: {
          composio: {
            tools: {},
            connections: {
              gmail: [
                {
                  kind: 'author',
                  toolkit: 'gmail',
                  connectionId: 'ca_existing',
                  label: 'personal',
                  scope: 'per-author',
                },
              ],
            },
          },
        },
      },
    });

    await tool!.execute!({
      name: 'Gmail agent',
      instructions: 'fetch mail',
      tools: [{ id: 'composio:GMAIL_FETCH_EMAILS', name: 'GMAIL_FETCH_EMAILS' }],
    } as any);

    const next = form().getValues('toolProviders');
    expect(next).toEqual({
      composio: {
        tools: {
          GMAIL_FETCH_EMAILS: { toolkit: 'gmail', description: 'Fetch Gmail emails' },
        },
        connections: {
          gmail: [
            {
              kind: 'author',
              toolkit: 'gmail',
              connectionId: 'ca_existing',
              label: 'personal',
              scope: 'per-author',
            },
          ],
        },
      },
    });
    // Integration ids must NOT leak into the native tools allowlist.
    expect(form().getValues('tools')).toEqual({});
  });

  it('writes both native tools and integration toolProviders when the LLM emits a mix', async () => {
    const availableAgentTools: AgentTool[] = [
      { id: 'tool-a', name: 'tool-a', isChecked: false, type: 'tool' },
      {
        id: 'composio:SLACK_POST',
        name: 'SLACK_POST',
        isChecked: false,
        type: 'integration',
        providerId: 'composio',
        toolkit: 'slack',
      },
    ];

    const { tool, form } = renderBuilderTool(availableAgentTools);

    await tool!.execute!({
      name: 'Mixed agent',
      instructions: 'do things',
      tools: [
        { id: 'tool-a', name: 'Tool A' },
        { id: 'composio:SLACK_POST', name: 'SLACK_POST' },
      ],
    } as any);

    expect(form().getValues('tools')).toEqual({ 'tool-a': true });
    expect(form().getValues('toolProviders')).toEqual({
      composio: {
        tools: { SLACK_POST: { toolkit: 'slack' } },
        connections: {},
      },
    });
  });

  it('returns undefined from the hook while the integration tool catalog is loading', () => {
    const { tool } = renderBuilderTool([], { integrationToolsLoading: true });
    expect(tool).toBeUndefined();
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

    expect(form().getValues('model')).toEqual({ provider: 'gateway/openai', name: 'gpt-4o' });
  });
});
