import { act, renderHook } from '@testing-library/react';
import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';

import { z } from 'zod';
import type { AgentBuilderEditFormValues } from '../../schemas';
import { SET_AGENT_MODEL_TOOL_NAME, useSetAgentModelTool } from '../use-set-agent-model-tool';
import type { ModelInfo } from '@/domains/llm';

const availableModels: ModelInfo[] = [
  { provider: 'openai', providerName: 'OpenAI', model: 'gpt-4o' },
  { provider: 'anthropic', providerName: 'Anthropic', model: 'claude-3-5-sonnet-latest' },
];

/** Reads the `.describe()` text a tool exposes to the model for one input field. */
const fieldDescription = (schema: unknown, field: string) =>
  (schema as z.ZodObject<z.ZodRawShape>).shape[field]?.description;

/**
 * Runs a tool inside `act` so the `setValue` re-render flushes before assertions.
 * The wrapper subscribes to `formState`, so every write re-renders.
 */
const runTool = async (tool: { execute?: (input: unknown) => Promise<unknown> }, input: unknown) => {
  let output: unknown;
  await act(async () => {
    output = await tool.execute!(input);
  });
  return output;
};

const renderTool = (models: ModelInfo[] = availableModels) => {
  const formRef: { current: ReturnType<typeof useForm<AgentBuilderEditFormValues>> | null } = { current: null };

  const Wrapper = ({ children }: { children: React.ReactNode }) => {
    const methods = useForm<AgentBuilderEditFormValues>({
      defaultValues: { name: '', description: '', instructions: '' },
    });
    formRef.current = methods;
    // RHF's formState is a proxy: a field is only tracked when it is read during
    // render, so subscribe here before the tool writes to the form.
    void methods.formState.dirtyFields;
    return React.createElement(FormProvider, methods, children);
  };

  const { result } = renderHook(() => useSetAgentModelTool({ availableModels: models }), { wrapper: Wrapper });
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
    await runTool(tool, { model: { provider: 'openai', name: 'gpt-4o' } });
    expect(form().getValues('model')).toEqual({ provider: 'openai', name: 'gpt-4o' });
  });

  it('cleans provider ids with sub-paths (e.g. openai.responses -> openai)', async () => {
    const { tool, form } = renderTool();
    await runTool(tool, { model: { provider: 'openai.responses', name: 'gpt-4o' } });
    expect(form().getValues('model')).toEqual({ provider: 'openai', name: 'gpt-4o' });
  });

  it('ignores empty provider or name', async () => {
    const { tool, form } = renderTool();
    await runTool(tool, { model: { provider: '', name: 'gpt-4o' } });
    expect(form().getValues('model')).toBeUndefined();

    await runTool(tool, { model: { provider: 'openai', name: '' } });
    expect(form().getValues('model')).toBeUndefined();
  });

  it('does nothing when model input is missing', async () => {
    const { tool, form } = renderTool();
    await runTool(tool, {});
    expect(form().getValues('model')).toBeUndefined();
  });

  it('survives being called with no input at all', async () => {
    const { tool, form } = renderTool();

    await expect(runTool(tool, undefined)).resolves.toEqual({ success: true });
    expect(form().getValues('model')).toBeUndefined();
  });

  it('reports success back to the model', async () => {
    const { tool } = renderTool();

    await expect(runTool(tool, { model: { provider: 'openai', name: 'gpt-4o' } })).resolves.toEqual({ success: true });
  });

  it('marks the field dirty so the form knows there are unsaved edits', async () => {
    const { tool, form } = renderTool();

    await runTool(tool, { model: { provider: 'openai', name: 'gpt-4o' } });

    expect(form().formState.dirtyFields.model).toBeTruthy();
  });

  it.each([
    ['a non-string provider', { provider: 42, name: 'gpt-4o' }],
    ['a non-string name', { provider: 'openai', name: 42 }],
    ['a non-object model', 'gpt-4o'],
  ])('ignores %s', async (_label, model) => {
    const { tool, form } = renderTool();

    await runTool(tool, { model });

    expect(form().getValues('model')).toBeUndefined();
  });

  it('lists the available models in the description the model reads', () => {
    const { tool } = renderTool();

    expect(tool.description).toContain('Set the model used by the agent');
    expect(tool.description).toContain('- provider: openai (OpenAI), name: gpt-4o');
    expect(tool.description).toContain('- provider: anthropic (Anthropic), name: claude-3-5-sonnet-latest');
  });

  it('lists each model on its own line', () => {
    const { tool } = renderTool();

    expect(tool.description).toContain(
      '- provider: openai (OpenAI), name: gpt-4o\n- provider: anthropic (Anthropic), name: claude-3-5-sonnet-latest',
    );
  });

  it('says nothing about models when none are available', () => {
    const { tool } = renderTool([]);

    expect(tool.description).toBe(
      'Set the model used by the agent. Only use a provider/name pair from the available models list.',
    );
  });

  it('restricts the input schema to the available provider/name pairs', () => {
    const { tool } = renderTool();

    expect(tool.inputSchema!.safeParse({ model: { provider: 'openai', name: 'gpt-4o' } }).success).toBe(true);
    expect(tool.inputSchema!.safeParse({ model: { provider: 'anthropic', name: 'gpt-4o' } }).success).toBe(false);
    expect(tool.inputSchema!.safeParse({ model: { provider: 'mistral', name: 'large' } }).success).toBe(false);
    expect(tool.inputSchema!.safeParse({}).success).toBe(false);
  });

  it('accepts the single available pair when only one model is offered', () => {
    const { tool } = renderTool([{ provider: 'openai', providerName: 'OpenAI', model: 'gpt-4o' }]);

    expect(tool.inputSchema!.safeParse({ model: { provider: 'openai', name: 'gpt-4o' } }).success).toBe(true);
    expect(tool.inputSchema!.safeParse({ model: { provider: 'anthropic', name: 'x' } }).success).toBe(false);
  });

  it('accepts any non-empty pair when no models are known', () => {
    const { tool } = renderTool([]);

    expect(tool.inputSchema!.safeParse({ model: { provider: 'anything', name: 'any-model' } }).success).toBe(true);
    expect(tool.inputSchema!.safeParse({ model: { provider: '', name: 'any-model' } }).success).toBe(false);
    expect(tool.inputSchema!.safeParse({ model: { provider: 'anything', name: '' } }).success).toBe(false);
  });

  it('documents the model field for the model', () => {
    const { tool } = renderTool();

    expect(fieldDescription(tool.inputSchema, 'model')).toContain('available provider/name pairs');
  });

  it('documents the provider and name of each offered pair', () => {
    const { tool } = renderTool([{ provider: 'openai', providerName: 'OpenAI', model: 'gpt-4o' }]);
    const pair = (tool.inputSchema as { shape: { model: unknown } }).shape.model;

    expect(fieldDescription(pair, 'provider')).toContain('available models list');
    expect(fieldDescription(pair, 'name')).toContain('available models list');
  });

  it('ignores a name that is array-shaped rather than a string', async () => {
    const { tool, form } = renderTool();

    await runTool(tool, { model: { provider: 'openai', name: ['gpt-4o'] } });

    expect(form().getValues('model')).toBeUndefined();
  });

  it('ignores a provider that is array-shaped rather than a string', async () => {
    const { tool, form } = renderTool();

    await runTool(tool, { model: { provider: ['openai'], name: 'gpt-4o' } });

    expect(form().getValues('model')).toBeUndefined();
  });

  it('declares a boolean success in its output schema', () => {
    const { tool } = renderTool();

    expect(tool.outputSchema!.safeParse({ success: true }).success).toBe(true);
    expect(tool.outputSchema!.safeParse({ success: 'yes' }).success).toBe(false);
    expect(tool.outputSchema!.safeParse({}).success).toBe(false);
  });
});
