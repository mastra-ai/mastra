import { renderHook } from '@testing-library/react';
import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';

import type { AgentBuilderEditFormValues } from '../../schemas';
import { SET_AGENT_NAME_TOOL_NAME, useSetAgentNameTool } from '../use-set-agent-name-tool';

const renderTool = () => {
  const formRef: { current: ReturnType<typeof useForm<AgentBuilderEditFormValues>> | null } = { current: null };

  const Wrapper = ({ children }: { children: React.ReactNode }) => {
    const methods = useForm<AgentBuilderEditFormValues>({
      defaultValues: { name: '', description: '', instructions: '' },
    });
    formRef.current = methods;
    return React.createElement(FormProvider, methods, children);
  };

  const { result } = renderHook(() => useSetAgentNameTool(), { wrapper: Wrapper });
  return { tool: result.current, form: () => formRef.current! };
};

describe('useSetAgentNameTool', () => {
  it('exposes the canonical tool id', () => {
    const { tool } = renderTool();
    expect(tool.id).toBe(SET_AGENT_NAME_TOOL_NAME);
    expect(tool.id).toBe('set-agent-name');
  });

  it('writes a non-empty name to the form', async () => {
    const { tool, form } = renderTool();
    await tool.execute!({ name: 'My Agent' } as any);
    expect(form().getValues('name')).toBe('My Agent');
  });

  it('does not write when name is missing or empty', async () => {
    const { tool, form } = renderTool();
    await tool.execute!({} as any);
    expect(form().getValues('name')).toBe('');

    await tool.execute!({ name: '' } as any);
    expect(form().getValues('name')).toBe('');
  });
});
