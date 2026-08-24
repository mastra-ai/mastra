import { act, renderHook } from '@testing-library/react';
import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';

import type { AgentBuilderEditFormValues } from '../../schemas';
import { SET_AGENT_WORKSPACE_ID_TOOL_NAME, useSetAgentWorkspaceIdTool } from '../use-set-agent-workspace-id-tool';

const availableWorkspaces = [
  { id: 'ws-1', name: 'Workspace One' },
  { id: 'ws-2', name: 'Workspace Two' },
];

/** Reads the `.describe()` text a tool exposes to the model for one input field. */
const fieldDescription = (schema: unknown, field: string) =>
  (schema as { shape: Record<string, { description?: string }> }).shape[field]?.description;

const runTool = async (tool: { execute?: (input: unknown) => Promise<unknown> }, input: unknown) => {
  let output: unknown;
  await act(async () => {
    output = await tool.execute!(input);
  });
  return output;
};

const renderTool = (workspaces: Array<{ id: string; name: string }> = availableWorkspaces) => {
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

  const { result } = renderHook(() => useSetAgentWorkspaceIdTool({ availableWorkspaces: workspaces }), {
    wrapper: Wrapper,
  });
  return { tool: result.current, form: () => formRef.current! };
};

describe('useSetAgentWorkspaceIdTool', () => {
  it('exposes the canonical tool id', () => {
    const { tool } = renderTool();
    expect(tool.id).toBe(SET_AGENT_WORKSPACE_ID_TOOL_NAME);
    expect(tool.id).toBe('set-agent-workspace-id');
  });

  it('writes the workspace id to the form', async () => {
    const { tool, form } = renderTool();
    await runTool(tool, { workspaceId: 'ws-1' });
    expect(form().getValues('workspaceId')).toBe('ws-1');
  });

  it('ignores empty workspace ids', async () => {
    const { tool, form } = renderTool();
    await runTool(tool, { workspaceId: '' });
    expect(form().getValues('workspaceId')).toBeUndefined();
  });

  it('does nothing when input is missing', async () => {
    const { tool, form } = renderTool();
    await runTool(tool, {});
    expect(form().getValues('workspaceId')).toBeUndefined();
  });

  it('survives being called with no input at all', async () => {
    const { tool, form } = renderTool();

    await expect(runTool(tool, undefined)).resolves.toEqual({ success: true });
    expect(form().getValues('workspaceId')).toBeUndefined();
  });

  it('reports success back to the model', async () => {
    const { tool } = renderTool();

    await expect(runTool(tool, { workspaceId: 'ws-1' })).resolves.toEqual({ success: true });
  });

  it('marks the field dirty so the form knows there are unsaved edits', async () => {
    const { tool, form } = renderTool();

    await runTool(tool, { workspaceId: 'ws-1' });

    expect(form().formState.dirtyFields.workspaceId).toBe(true);
  });

  it('lists the available workspaces in the description the model reads', () => {
    const { tool } = renderTool();

    expect(tool.description).toContain('Set the workspace the agent should belong to');
    expect(tool.description).toContain('- ws-1: Workspace One');
    expect(tool.description).toContain('- ws-2: Workspace Two');
  });

  it('lists each workspace on its own line', () => {
    const { tool } = renderTool();

    expect(tool.description).toContain('- ws-1: Workspace One\n- ws-2: Workspace Two');
  });

  it('says nothing about workspaces when none are available', () => {
    const { tool } = renderTool([]);

    expect(tool.description).toBe(
      'Set the workspace the agent should belong to. Only use ids from the available workspaces list.',
    );
  });

  it('restricts the input schema to the available workspace ids', () => {
    const { tool } = renderTool();

    expect(tool.inputSchema!.safeParse({ workspaceId: 'ws-1' }).success).toBe(true);
    expect(tool.inputSchema!.safeParse({ workspaceId: 'ws-unknown' }).success).toBe(false);
    expect(tool.inputSchema!.safeParse({}).success).toBe(false);
  });

  it('accepts any id when no workspaces are known', () => {
    const { tool } = renderTool([]);

    expect(tool.inputSchema!.safeParse({ workspaceId: 'ws-anything' }).success).toBe(true);
    expect(tool.inputSchema!.safeParse({ workspaceId: 42 }).success).toBe(false);
  });

  it('documents the workspaceId field for the model', () => {
    const { tool } = renderTool();

    expect(fieldDescription(tool.inputSchema, 'workspaceId')).toContain('available workspaces list');
  });

  it('declares a boolean success in its output schema', () => {
    const { tool } = renderTool();

    expect(tool.outputSchema!.safeParse({ success: true }).success).toBe(true);
    expect(tool.outputSchema!.safeParse({ success: 'yes' }).success).toBe(false);
    expect(tool.outputSchema!.safeParse({}).success).toBe(false);
  });

  it('rebuilds itself when the workspace list changes', async () => {
    const formRef: { current: ReturnType<typeof useForm<AgentBuilderEditFormValues>> | null } = { current: null };

    const Wrapper = ({ children }: { children: React.ReactNode }) => {
      const methods = useForm<AgentBuilderEditFormValues>({ defaultValues: { name: '' } });
      formRef.current = methods;
      return React.createElement(FormProvider, methods, children);
    };

    const { result, rerender } = renderHook(
      ({ workspaces }: { workspaces: Array<{ id: string; name: string }> }) =>
        useSetAgentWorkspaceIdTool({ availableWorkspaces: workspaces }),
      { wrapper: Wrapper, initialProps: { workspaces: availableWorkspaces } },
    );

    expect(result.current.description).toContain('- ws-1: Workspace One');

    rerender({ workspaces: [{ id: 'ws-9', name: 'Workspace Nine' }] });

    expect(result.current.description).toContain('- ws-9: Workspace Nine');
    expect(result.current.description).not.toContain('ws-1');
    expect(result.current.inputSchema!.safeParse({ workspaceId: 'ws-9' }).success).toBe(true);
    expect(result.current.inputSchema!.safeParse({ workspaceId: 'ws-1' }).success).toBe(false);
  });
});
