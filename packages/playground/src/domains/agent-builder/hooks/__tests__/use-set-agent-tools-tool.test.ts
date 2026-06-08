// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';

import type { AgentBuilderEditFormValues } from '../../schemas';
import type { AgentTool } from '../../types/agent-tool';
import { SET_AGENT_TOOLS_TOOL_NAME, useSetAgentToolsTool } from '../use-set-agent-tools-tool';

const availableAgentTools: AgentTool[] = [
  { id: 'web-search', name: 'web-search', type: 'tool', isChecked: false },
  { id: 'agent-helper', name: 'Helper Agent', type: 'agent', isChecked: false },
  { id: 'wf-build', name: 'Build Workflow', type: 'workflow', isChecked: false },
];

const renderTool = () => {
  const formRef: { current: ReturnType<typeof useForm<AgentBuilderEditFormValues>> | null } = { current: null };

  const Wrapper = ({ children }: { children: React.ReactNode }) => {
    const methods = useForm<AgentBuilderEditFormValues>({
      defaultValues: { name: '', description: '', instructions: '', tools: {}, agents: {}, workflows: {} },
    });
    formRef.current = methods;
    return React.createElement(FormProvider, methods, children);
  };

  const { result } = renderHook(() => useSetAgentToolsTool({ availableAgentTools }), { wrapper: Wrapper });
  return { tool: result.current, form: () => formRef.current! };
};

describe('useSetAgentToolsTool', () => {
  it('exposes the canonical tool id', () => {
    const { tool } = renderTool();
    expect(tool.id).toBe(SET_AGENT_TOOLS_TOOL_NAME);
    expect(tool.id).toBe('set-agent-tools');
  });

  it('routes tools/agents/workflows into the correct form keys', async () => {
    const { tool, form } = renderTool();
    await tool.execute!({
      tools: [
        { id: 'web-search', name: 'Web Search' },
        { id: 'agent-helper', name: 'Helper' },
        { id: 'wf-build', name: 'Build' },
      ],
    } as any);

    expect(form().getValues('tools')).toEqual({ 'web-search': true });
    expect(form().getValues('agents')).toEqual({ 'agent-helper': true });
    expect(form().getValues('workflows')).toEqual({ 'wf-build': true });
  });

  it('clears all three maps when given an empty array', async () => {
    const { tool, form } = renderTool();
    form().setValue('tools', { 'web-search': true });
    form().setValue('agents', { 'agent-helper': true });
    form().setValue('workflows', { 'wf-build': true });

    await tool.execute!({ tools: [] } as any);

    expect(form().getValues('tools')).toEqual({});
    expect(form().getValues('agents')).toEqual({});
    expect(form().getValues('workflows')).toEqual({});
  });

  it('ignores ids not present in availableAgentTools', async () => {
    const { tool, form } = renderTool();
    await tool.execute!({
      tools: [
        { id: 'web-search', name: 'Web Search' },
        { id: 'unknown', name: 'Unknown' },
      ],
    } as any);

    expect(form().getValues('tools')).toEqual({ 'web-search': true });
    expect(form().getValues('agents')).toEqual({});
    expect(form().getValues('workflows')).toEqual({});
  });

  it('does nothing when input is missing or not an array', async () => {
    const { tool, form } = renderTool();
    form().setValue('tools', { 'web-search': true });
    await tool.execute!({} as any);
    expect(form().getValues('tools')).toEqual({ 'web-search': true });
  });
});
