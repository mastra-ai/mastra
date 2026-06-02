// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';

import type { AgentBuilderEditFormValues } from '../../schemas';
import { MAX_GENERATED_INSTRUCTIONS_CHARS } from '../../services/build-form-snapshot';
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

  it('passes through instructions at or below the hard cap unchanged', async () => {
    const { tool, form } = renderTool();
    const body = 'a'.repeat(MAX_GENERATED_INSTRUCTIONS_CHARS);
    const result: any = await tool.execute!({ instructions: body } as any);
    expect(form().getValues('instructions')).toBe(body);
    expect(result.success).toBe(true);
    expect(result.rejected).toBe(false);
    expect(result.finalLength).toBe(MAX_GENERATED_INSTRUCTIONS_CHARS);
  });

  it('rejects instructions past the hard cap without persisting', async () => {
    const { tool, form } = renderTool();
    const body = 'a'.repeat(MAX_GENERATED_INSTRUCTIONS_CHARS + 500);
    const result: any = await tool.execute!({ instructions: body } as any);
    // Nothing was written to the form.
    expect(form().getValues('instructions')).toBe('');
    expect(result.success).toBe(false);
    expect(result.rejected).toBe(true);
    expect(result.currentLength).toBe(MAX_GENERATED_INSTRUCTIONS_CHARS + 500);
    expect(result.limit).toBe(MAX_GENERATED_INSTRUCTIONS_CHARS);
    // Tool result message tells the LLM exactly what to do.
    expect(result.message).toMatch(/REJECTED/);
    expect(result.message).toMatch(/whole section/i);
  });
});
