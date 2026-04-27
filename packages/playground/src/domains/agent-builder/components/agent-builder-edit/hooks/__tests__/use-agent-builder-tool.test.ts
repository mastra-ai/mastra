// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';
import type { AgentBuilderEditFormValues } from '../../../../schemas';
import type { AgentTool } from '../../../../types/agent-tool';
import { useAgentBuilderTool } from '../use-agent-builder-tool';

vi.mock('../../../../hooks/use-builder-agent-features', () => ({
  useBuilderAgentFeatures: () => ({ tools: true, memory: false, workflows: false, agents: true }),
}));

const features = { tools: true, memory: false, workflows: false, agents: true } as const;

const renderBuilderTool = (availableAgentTools: AgentTool[]) => {
  const formRef: { current: ReturnType<typeof useForm<AgentBuilderEditFormValues>> | null } = {
    current: null,
  };

  const Wrapper = ({ children }: { children: React.ReactNode }) => {
    const methods = useForm<AgentBuilderEditFormValues>({
      defaultValues: { name: '', description: '', instructions: '', tools: {}, agents: {} },
    });
    formRef.current = methods;
    return React.createElement(FormProvider, methods, children);
  };

  const { result } = renderHook(() => useAgentBuilderTool({ features, availableAgentTools }), {
    wrapper: Wrapper,
  });

  return { tool: result.current, form: () => formRef.current! };
};

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
});
