import { renderHook } from '@testing-library/react';
import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';

import type { AgentBuilderEditFormValues } from '../../schemas';
import { SET_AGENT_MODEL_TOOL_NAME, useSetAgentModelTool } from '../use-set-agent-model-tool';
import type { ModelInfo } from '@/domains/llm';

const availableModels: ModelInfo[] = [
  { provider: 'openai', providerName: 'OpenAI', model: 'gpt-4o' },
  { provider: 'anthropic', providerName: 'Anthropic', model: 'claude-3-5-sonnet-latest' },
];

const renderTool = () => {
  const formRef: { current: ReturnType<typeof useForm<AgentBuilderEditFormValues>> | null } = { current: null };

  const Wrapper = ({ children }: { children: React.ReactNode }) => {
    const methods = useForm<AgentBuilderEditFormValues>({
      defaultValues: { name: '', description: '', instructions: '' },
    });
    formRef.current = methods;
    return React.createElement(FormProvider, methods, children);
  };

  const { result } = renderHook(() => useSetAgentModelTool({ availableModels }), { wrapper: Wrapper });
  return { tool: result.current, form: () => formRef.current! };
};

describe('useSetAgentModelTool', () => {
  it('exposes the canonical tool id', () => {
    const { tool } = renderTool();
    expect(tool.id).toBe(SET_AGENT_MODEL_TOOL_NAME);
    expect(tool.id).toBe('set-agent-model');
  });

  it('writes the model provider/name pair to the form', async () => {
    const { tool, form } = renderTool();
    await tool.execute!({ model: { provider: 'openai', name: 'gpt-4o' } } as any);
    expect(form().getValues('model')).toEqual({ provider: 'openai', name: 'gpt-4o' });
  });

  it('cleans provider ids with sub-paths (e.g. openai.responses -> openai)', async () => {
    const { tool, form } = renderTool();
    await tool.execute!({ model: { provider: 'openai.responses', name: 'gpt-4o' } } as any);
    expect(form().getValues('model')).toEqual({ provider: 'openai', name: 'gpt-4o' });
  });

  it('ignores empty provider or name', async () => {
    const { tool, form } = renderTool();
    await tool.execute!({ model: { provider: '', name: 'gpt-4o' } } as any);
    expect(form().getValues('model')).toBeUndefined();

    await tool.execute!({ model: { provider: 'openai', name: '' } } as any);
    expect(form().getValues('model')).toBeUndefined();
  });

  it('does nothing when model input is missing', async () => {
    const { tool, form } = renderTool();
    await tool.execute!({} as any);
    expect(form().getValues('model')).toBeUndefined();
  });
});
