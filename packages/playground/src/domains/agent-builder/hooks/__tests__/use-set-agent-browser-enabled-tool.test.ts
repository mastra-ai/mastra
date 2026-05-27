// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';

import type { AgentBuilderEditFormValues } from '../../schemas';
import {
  SET_AGENT_BROWSER_ENABLED_TOOL_NAME,
  useSetAgentBrowserEnabledTool,
} from '../use-set-agent-browser-enabled-tool';

const renderTool = () => {
  const formRef: { current: ReturnType<typeof useForm<AgentBuilderEditFormValues>> | null } = { current: null };

  const Wrapper = ({ children }: { children: React.ReactNode }) => {
    const methods = useForm<AgentBuilderEditFormValues>({
      defaultValues: { name: '', description: '', instructions: '', browserEnabled: false },
    });
    formRef.current = methods;
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
    await tool.execute!({ browserEnabled: true } as any);
    expect(form().getValues('browserEnabled')).toBe(true);
  });

  it('writes false to the form', async () => {
    const { tool, form } = renderTool();
    form().setValue('browserEnabled', true);
    await tool.execute!({ browserEnabled: false } as any);
    expect(form().getValues('browserEnabled')).toBe(false);
  });

  it('ignores non-boolean values', async () => {
    const { tool, form } = renderTool();
    await tool.execute!({ browserEnabled: 'yes' } as any);
    expect(form().getValues('browserEnabled')).toBe(false);

    await tool.execute!({} as any);
    expect(form().getValues('browserEnabled')).toBe(false);
  });
});
