import { act, renderHook } from '@testing-library/react';
import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import type { AgentBuilderEditFormValues } from '../../schemas';
import {
  SET_AGENT_BROWSER_ENABLED_TOOL_NAME,
  useSetAgentBrowserEnabledTool,
} from '../use-set-agent-browser-enabled-tool';

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
      defaultValues: { name: '', description: '', instructions: '', browserEnabled: false },
    });
    formRef.current = methods;
    // RHF's formState is a proxy: a field is only tracked when it is read during
    // render, so subscribe here before the tool writes to the form.
    void methods.formState.dirtyFields;
    return React.createElement(FormProvider, methods, children);
  };

  const { result } = renderHook(() => useSetAgentBrowserEnabledTool(), { wrapper: Wrapper });
  return { tool: result.current, form: () => formRef.current! };
};

describe('useSetAgentBrowserEnabledTool', () => {
  it('exposes the canonical tool id', () => {
    const { tool } = renderTool();
    expect(tool.id).toBe(SET_AGENT_BROWSER_ENABLED_TOOL_NAME);
    expect(tool.id).toBe('set-agent-browser-enabled');
  });

  it('writes true to the form', async () => {
    const { tool, form } = renderTool();
    await runTool(tool, { browserEnabled: true });
    expect(form().getValues('browserEnabled')).toBe(true);
  });

  it('writes false to the form', async () => {
    const { tool, form } = renderTool();
    form().setValue('browserEnabled', true);
    await runTool(tool, { browserEnabled: false });
    expect(form().getValues('browserEnabled')).toBe(false);
  });

  it('ignores non-boolean values', async () => {
    const { tool, form } = renderTool();
    await runTool(tool, { browserEnabled: 'yes' });
    expect(form().getValues('browserEnabled')).toBe(false);

    await runTool(tool, {});
    expect(form().getValues('browserEnabled')).toBe(false);
  });

  it('survives being called with no input at all', async () => {
    const { tool, form } = renderTool();

    await expect(runTool(tool, undefined)).resolves.toEqual({ success: true });
    expect(form().getValues('browserEnabled')).toBe(false);
  });

  it('reports success back to the model', async () => {
    const { tool } = renderTool();

    await expect(runTool(tool, { browserEnabled: true })).resolves.toEqual({ success: true });
  });

  it('marks the field dirty so the form knows there are unsaved edits', async () => {
    const { tool, form } = renderTool();

    await runTool(tool, { browserEnabled: true });

    expect(form().formState.dirtyFields.browserEnabled).toBe(true);
  });

  it('tells the model when to reach for it', () => {
    const { tool } = renderTool();

    expect(tool.description).toContain('browser access');
  });

  it('requires a boolean in its input schema', () => {
    const { tool } = renderTool();

    expect(tool.inputSchema!.safeParse({ browserEnabled: true }).success).toBe(true);
    expect(tool.inputSchema!.safeParse({ browserEnabled: 'yes' }).success).toBe(false);
    expect(tool.inputSchema!.safeParse({}).success).toBe(false);
  });

  it('documents the browserEnabled field for the model', () => {
    const { tool } = renderTool();

    expect(fieldDescription(tool.inputSchema, 'browserEnabled')).toContain('browse the web');
  });

  it('declares a boolean success in its output schema', () => {
    const { tool } = renderTool();

    expect(tool.outputSchema!.safeParse({ success: true }).success).toBe(true);
    expect(tool.outputSchema!.safeParse({ success: 'yes' }).success).toBe(false);
    expect(tool.outputSchema!.safeParse({}).success).toBe(false);
  });
});
