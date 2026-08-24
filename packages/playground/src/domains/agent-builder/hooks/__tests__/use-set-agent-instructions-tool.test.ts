import { act, renderHook } from '@testing-library/react';
import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';

import type { AgentBuilderEditFormValues } from '../../schemas';
import { MAX_GENERATED_INSTRUCTIONS_CHARS } from '../../services/build-form-snapshot';
import { SET_AGENT_INSTRUCTIONS_TOOL_NAME, useSetAgentInstructionsTool } from '../use-set-agent-instructions-tool';

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
    await runTool(tool, { instructions: 'Be helpful and concise.' });
    expect(form().getValues('instructions')).toBe('Be helpful and concise.');
  });

  it('supports multi-paragraph markdown', async () => {
    const { tool, form } = renderTool();
    const body = '# Role\nYou are a helpful agent.\n\n## Style\nBe concise.';
    await runTool(tool, { instructions: body });
    expect(form().getValues('instructions')).toBe(body);
  });

  it('ignores non-string instructions', async () => {
    const { tool, form } = renderTool();
    await runTool(tool, {});
    expect(form().getValues('instructions')).toBe('');
  });

  it('rejects overly long instructions without exposing the hard limit in the message', async () => {
    const { tool, form } = renderTool();
    const seeded = 'Existing valid instructions.';
    form().setValue('instructions', seeded);

    const body = 'a'.repeat(MAX_GENERATED_INSTRUCTIONS_CHARS + 500);
    const result: any = await runTool(tool, { instructions: body });

    expect(form().getValues('instructions')).toBe(seeded);
    expect(result.success).toBe(false);
    expect(result.rejected).toBe(true);
    expect(result.currentLength).toBe(MAX_GENERATED_INSTRUCTIONS_CHARS + 500);
    expect(result.limit).toBe(MAX_GENERATED_INSTRUCTIONS_CHARS);
    expect(result.message).toMatch(/too long/i);
    expect(result.message).toMatch(/1,200–2,000 characters/i);
    expect(result.message).not.toContain(String(MAX_GENERATED_INSTRUCTIONS_CHARS));
  });

  it('survives being called with no input at all', async () => {
    const { tool, form } = renderTool();

    await expect(runTool(tool, undefined)).resolves.toEqual({ success: true });
    expect(form().getValues('instructions')).toBe('');
  });

  it('reports what it persisted back to the model', async () => {
    const { tool } = renderTool();

    await expect(runTool(tool, { instructions: 'Be helpful.' })).resolves.toEqual({
      success: true,
      rejected: false,
      currentLength: 'Be helpful.'.length,
      finalLength: 'Be helpful.'.length,
    });
  });

  it('accepts instructions exactly at the limit', async () => {
    const { tool, form } = renderTool();
    const body = 'a'.repeat(MAX_GENERATED_INSTRUCTIONS_CHARS);

    const result = (await runTool(tool, { instructions: body })) as { success: boolean };

    expect(result.success).toBe(true);
    expect(form().getValues('instructions')).toBe(body);
  });

  it('rejects instructions one character over the limit', async () => {
    const { tool, form } = renderTool();
    const body = 'a'.repeat(MAX_GENERATED_INSTRUCTIONS_CHARS + 1);

    const result = (await runTool(tool, { instructions: body })) as { success: boolean };

    expect(result.success).toBe(false);
    expect(form().getValues('instructions')).toBe('');
  });

  it('marks the field dirty so the form knows there are unsaved edits', async () => {
    const { tool, form } = renderTool();

    await runTool(tool, { instructions: 'Be helpful.' });

    expect(form().formState.dirtyFields.instructions).toBe(true);
  });

  it('tells the model when to reach for it', () => {
    const { tool } = renderTool();

    expect(tool.description).toContain('agent instructions');
  });

  it('requires a string in its input schema', () => {
    const { tool } = renderTool();

    expect(tool.inputSchema!.safeParse({ instructions: 'Be helpful.' }).success).toBe(true);
    expect(tool.inputSchema!.safeParse({ instructions: 42 }).success).toBe(false);
    expect(tool.inputSchema!.safeParse({}).success).toBe(false);
  });

  it('documents the instructions field for the model', () => {
    const { tool } = renderTool();

    expect(fieldDescription(tool.inputSchema, 'instructions')).toContain('system prompt');
  });

  it('declares the rejection envelope in its output schema', () => {
    const { tool } = renderTool();

    expect(tool.outputSchema!.safeParse({ success: true }).success).toBe(true);
    expect(
      tool.outputSchema!.safeParse({ success: false, rejected: true, currentLength: 1, limit: 2, message: 'x' })
        .success,
    ).toBe(true);
    expect(tool.outputSchema!.safeParse({ success: 'yes' }).success).toBe(false);
    expect(tool.outputSchema!.safeParse({ success: true, currentLength: 'long' }).success).toBe(false);
    expect(tool.outputSchema!.safeParse({}).success).toBe(false);
  });
});
