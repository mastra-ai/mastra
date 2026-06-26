import { renderHook } from '@testing-library/react';
import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';

import type { AgentBuilderEditFormValues } from '../../schemas';
import { SET_AGENT_WORKSPACE_ID_TOOL_NAME, useSetAgentWorkspaceIdTool } from '../use-set-agent-workspace-id-tool';

const availableWorkspaces = [
  { id: 'ws-1', name: 'Workspace One' },
  { id: 'ws-2', name: 'Workspace Two' },
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

  const { result } = renderHook(() => useSetAgentWorkspaceIdTool({ availableWorkspaces }), { wrapper: Wrapper });
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
    await tool.execute!({ workspaceId: 'ws-1' } as any);
    expect(form().getValues('workspaceId')).toBe('ws-1');
  });

  it('ignores empty workspace ids', async () => {
    const { tool, form } = renderTool();
    await tool.execute!({ workspaceId: '' } as any);
    expect(form().getValues('workspaceId')).toBeUndefined();
  });

  it('does nothing when input is missing', async () => {
    const { tool, form } = renderTool();
    await tool.execute!({} as any);
    expect(form().getValues('workspaceId')).toBeUndefined();
  });
});
