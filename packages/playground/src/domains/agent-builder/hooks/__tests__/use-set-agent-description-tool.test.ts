// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';

import type { AgentBuilderEditFormValues } from '../../schemas';
import { SET_AGENT_DESCRIPTION_TOOL_NAME, useSetAgentDescriptionTool } from '../use-set-agent-description-tool';

const renderTool = () => {
  const formRef: { current: ReturnType<typeof useForm<AgentBuilderEditFormValues>> | null } = { current: null };

  const Wrapper = ({ children }: { children: React.ReactNode }) => {
    const methods = useForm<AgentBuilderEditFormValues>({
      defaultValues: { name: '', description: '', instructions: '' },
    });
    formRef.current = methods;
    return React.createElement(FormProvider, methods, children);
  };

  const { result } = renderHook(() => useSetAgentDescriptionTool(), { wrapper: Wrapper });
  return { tool: result.current, form: () => formRef.current! };
};

describe('useSetAgentDescriptionTool', () => {
  it('exposes the canonical tool id', () => {
    const { tool } = renderTool();
    expect(tool.id).toBe(SET_AGENT_DESCRIPTION_TOOL_NAME);
    expect(tool.id).toBe('set-agent-description');
  });

  it('writes the description to the form', async () => {
    const { tool, form } = renderTool();
    await tool.execute!({ description: 'A helpful agent' } as any);
    expect(form().getValues('description')).toBe('A helpful agent');
  });

  it('allows clearing the description with an empty string', async () => {
    const { tool, form } = renderTool();
    await tool.execute!({ description: 'something' } as any);
    await tool.execute!({ description: '' } as any);
    expect(form().getValues('description')).toBe('');
  });

  it('ignores non-string descriptions', async () => {
    const { tool, form } = renderTool();
    await tool.execute!({} as any);
    expect(form().getValues('description')).toBe('');
  });
});
