import { act, renderHook } from '@testing-library/react';
import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';

import type { AgentBuilderEditFormValues } from '../../schemas';
import { SET_AGENT_DESCRIPTION_TOOL_NAME, useSetAgentDescriptionTool } from '../use-set-agent-description-tool';

/** Reads the `.describe()` text a tool exposes to the model for one input field. */
const fieldDescription = (schema: unknown, field: string) =>
  (schema as { shape: Record<string, { description?: string }> }).shape[field]?.description;

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

const renderTool = () => {
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
    await runTool(tool, { description: 'A helpful agent' });
    expect(form().getValues('description')).toBe('A helpful agent');
  });

  it('allows clearing the description with an empty string', async () => {
    const { tool, form } = renderTool();
    await runTool(tool, { description: 'something' });
    await runTool(tool, { description: '' });
    expect(form().getValues('description')).toBe('');
  });

  it('ignores non-string descriptions', async () => {
    const { tool, form } = renderTool();
    await runTool(tool, {});
    expect(form().getValues('description')).toBe('');
  });

  it('survives being called with no input at all', async () => {
    const { tool, form } = renderTool();

    await expect(runTool(tool, undefined)).resolves.toEqual({ success: true });
    expect(form().getValues('description')).toBe('');
  });

  it('reports success back to the model', async () => {
    const { tool } = renderTool();

    await expect(runTool(tool, { description: 'A helpful agent' })).resolves.toEqual({ success: true });
  });

  it('marks the field dirty so the form knows there are unsaved edits', async () => {
    const { tool, form } = renderTool();

    await runTool(tool, { description: 'A helpful agent' });

    expect(form().formState.dirtyFields.description).toBe(true);
  });

  it('tells the model when to reach for it', () => {
    const { tool } = renderTool();

    expect(tool.description).toContain('agent description');
  });

  it('requires a string description in its input schema', () => {
    const { tool } = renderTool();

    expect(tool.inputSchema!.safeParse({ description: 'A helpful agent' }).success).toBe(true);
    expect(tool.inputSchema!.safeParse({ description: 42 }).success).toBe(false);
    expect(tool.inputSchema!.safeParse({}).success).toBe(false);
  });

  it('documents the description field for the model', () => {
    const { tool } = renderTool();

    expect(fieldDescription(tool.inputSchema, 'description')).toContain('browsing agents');
  });

  it('declares a boolean success in its output schema', () => {
    const { tool } = renderTool();

    expect(tool.outputSchema!.safeParse({ success: true }).success).toBe(true);
    expect(tool.outputSchema!.safeParse({ success: 'yes' }).success).toBe(false);
    expect(tool.outputSchema!.safeParse({}).success).toBe(false);
  });
});
