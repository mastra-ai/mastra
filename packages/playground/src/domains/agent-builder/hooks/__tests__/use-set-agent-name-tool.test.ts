import { act, renderHook } from '@testing-library/react';
import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';

import { z } from 'zod';
import type { AgentBuilderEditFormValues } from '../../schemas';
import { SET_AGENT_NAME_TOOL_NAME, useSetAgentNameTool } from '../use-set-agent-name-tool';

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
    await runTool(tool, { name: 'My Agent' });
    expect(form().getValues('name')).toBe('My Agent');
  });

  it('does not write when name is missing or empty', async () => {
    const { tool, form } = renderTool();
    await runTool(tool, {});
    expect(form().getValues('name')).toBe('');

    await runTool(tool, { name: '' });
    expect(form().getValues('name')).toBe('');
  });

  it('leaves an existing name untouched when handed an empty one', async () => {
    const { tool, form } = renderTool();
    await runTool(tool, { name: 'Researcher' });

    await runTool(tool, { name: '' });

    expect(form().getValues('name')).toBe('Researcher');
  });

  it('survives being called with no input at all', async () => {
    const { tool, form } = renderTool();

    await expect(runTool(tool, undefined)).resolves.toEqual({ success: true });
    expect(form().getValues('name')).toBe('');
  });

  it('reports success back to the model', async () => {
    const { tool } = renderTool();

    await expect(runTool(tool, { name: 'Researcher' })).resolves.toEqual({ success: true });
  });

  it('marks the field dirty so the form knows there are unsaved edits', async () => {
    const { tool, form } = renderTool();

    await runTool(tool, { name: 'Researcher' });

    expect(form().formState.dirtyFields.name).toBe(true);
  });

  it('tells the model when to reach for it', () => {
    const { tool } = renderTool();

    expect(tool.description).toContain('agent name');
  });

  it('requires a non-empty name in its input schema', () => {
    const { tool } = renderTool();

    expect(tool.inputSchema!.safeParse({ name: 'Researcher' }).success).toBe(true);
    expect(tool.inputSchema!.safeParse({ name: '' }).success).toBe(false);
    expect(tool.inputSchema!.safeParse({}).success).toBe(false);
  });

  it('accepts a long name rather than capping its length', () => {
    const { tool } = renderTool();

    expect(tool.inputSchema!.safeParse({ name: 'A Rather Long Agent Name' }).success).toBe(true);
  });

  it('documents the name field for the model', () => {
    const { tool } = renderTool();

    expect(fieldDescription(tool.inputSchema, 'name')).toContain('Title Case');
  });

  it('declares a boolean success in its output schema', () => {
    const { tool } = renderTool();

    expect(tool.outputSchema!.safeParse({ success: true }).success).toBe(true);
    expect(tool.outputSchema!.safeParse({ success: 'yes' }).success).toBe(false);
    expect(tool.outputSchema!.safeParse({}).success).toBe(false);
  });
});
