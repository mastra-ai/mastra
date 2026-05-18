// @vitest-environment jsdom
import type { StoredSkillResponse } from '@mastra/client-js';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';
import type { AgentBuilderEditFormValues } from '../../../../schemas';
import type { AgentTool } from '../../../../types/agent-tool';
import { useAgentBuilderTool } from '../use-agent-builder-tool';
import type { ModelInfo } from '@/domains/llm';

vi.mock('../../../../hooks/use-builder-agent-features', () => ({
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

    expect(form().getValues('model')).toEqual({ provider: 'gateway/openai', name: 'gpt-4o' });
  });

  it('merges integration tools into form.toolIntegrations, preserving existing connections', async () => {
    const availableAgentTools: AgentTool[] = [
      {
        id: 'integration:composio:GMAIL_FETCH_EMAILS',
        name: 'GMAIL_FETCH_EMAILS',
        description: 'Fetch emails',
        isChecked: false,
        type: 'integration',
        providerId: 'composio',
        toolService: 'gmail',
      },
    ];

    const { tool, form } = renderBuilderTool(availableAgentTools);
    // Seed the form with an existing connection that must survive the merge.
    form().setValue('toolIntegrations', {
      composio: {
        tools: {},
        connections: {
          gmail: [{ kind: 'author', toolService: 'gmail', connectionId: 'conn-1', label: 'WORK' }],
        },
      },
    });

    await tool.execute!({
      name: 'With integration',
      instructions: 'do things',
      tools: [{ id: 'integration:composio:GMAIL_FETCH_EMAILS', name: 'Fetch Emails' }],
    } as any);

    const next = form().getValues('toolIntegrations');
    expect(next).toEqual({
      composio: {
        tools: {
          GMAIL_FETCH_EMAILS: { toolService: 'gmail', description: 'Fetch emails' },
        },
        connections: {
          gmail: [{ kind: 'author', toolService: 'gmail', connectionId: 'conn-1', label: 'WORK' }],
        },
      },
    });
    // Legacy tools record must not pick up integration ids.
    expect(form().getValues('tools')).toEqual({});
  });

  it('removes an integration tool when omitted from the next tools array but keeps connections', async () => {
    const availableAgentTools: AgentTool[] = [
      {
        id: 'integration:composio:GMAIL_FETCH_EMAILS',
        name: 'GMAIL_FETCH_EMAILS',
        isChecked: true,
        type: 'integration',
        providerId: 'composio',
        toolService: 'gmail',
      },
    ];

    const { tool, form } = renderBuilderTool(availableAgentTools);
    form().setValue('toolIntegrations', {
      composio: {
        tools: { GMAIL_FETCH_EMAILS: { toolService: 'gmail' } },
        connections: {
          gmail: [{ kind: 'author', toolService: 'gmail', connectionId: 'conn-1', label: 'WORK' }],
        },
      },
    });

    await tool.execute!({
      name: 'No integration tools',
      instructions: 'do things',
      tools: [],
    } as any);

    expect(form().getValues('toolIntegrations')).toEqual({
      composio: {
        tools: {},
        connections: {
          gmail: [{ kind: 'author', toolService: 'gmail', connectionId: 'conn-1', label: 'WORK' }],
        },
      },
    });
  });

  it('never writes credentials, labels, or connection ids from LLM input', async () => {
    const availableAgentTools: AgentTool[] = [
      {
        id: 'integration:composio:GMAIL_FETCH_EMAILS',
        name: 'GMAIL_FETCH_EMAILS',
        isChecked: false,
        type: 'integration',
        providerId: 'composio',
        toolService: 'gmail',
      },
    ];

    const { tool, form } = renderBuilderTool(availableAgentTools);

    await tool.execute!({
      name: 'Hostile input',
      instructions: 'do things',
      tools: [{ id: 'integration:composio:GMAIL_FETCH_EMAILS', name: 'Fetch Emails' }],
      // Pretend the LLM tried to inject credentials/labels — must be ignored.
      toolIntegrations: {
        composio: {
          connections: {
            gmail: [{ kind: 'author', toolService: 'gmail', connectionId: 'attacker', label: 'PWNED' }],
          },
        },
      },
    } as any);

    const next = form().getValues('toolIntegrations');
    // Connections stay empty (no pre-seed), so no attacker connectionId/label leaks in.
    expect(next?.composio?.connections).toEqual({});
  });
});
