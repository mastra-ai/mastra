// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';

import type { AgentBuilderEditFormValues } from '../../schemas';
import { SET_AGENT_INSTRUCTIONS_TOOL_NAME, useSetAgentInstructionsTool } from '../use-set-agent-instructions-tool';

const renderTool = () => {
  const formRef: { current: ReturnType<typeof useForm<AgentBuilderEditFormValues>> | null } = { current: null };

  const Wrapper = ({ children }: { children: React.ReactNode }) => {
    const methods = useForm<AgentBuilderEditFormValues>({
      defaultValues: { name: '', description: '', instructions: '' },
    });
    formRef.current = methods;
    return React.createElement(FormProvider, methods, children);
  };

  const { result } = renderHook(() => useSetAgentInstructionsTool(), { wrapper: Wrapper });
  return { tool: result.current, form: () => formRef.current! };
};

describe('useSetAgentInstructionsTool', () => {
  it('exposes the canonical tool id', () => {
    const { tool } = renderTool();
    expect(tool.id).toBe(SET_AGENT_INSTRUCTIONS_TOOL_NAME);
    expect(tool.id).toBe('set-agent-instructions');
  });

  it('writes instructions to the form', async () => {
    const { tool, form } = renderTool();
    await tool.execute!({ instructions: 'Be helpful and concise.' } as any);
    expect(form().getValues('instructions')).toBe('Be helpful and concise.');
  });

  it('supports multi-paragraph markdown', async () => {
    const { tool, form } = renderTool();
    const body = '# Role\nYou are a helpful agent.\n\n## Style\nBe concise.';
    await tool.execute!({ instructions: body } as any);
    expect(form().getValues('instructions')).toBe(body);
  });

  it('ignores non-string instructions', async () => {
    const { tool, form } = renderTool();
    await tool.execute!({} as any);
    expect(form().getValues('instructions')).toBe('');
  });
});
