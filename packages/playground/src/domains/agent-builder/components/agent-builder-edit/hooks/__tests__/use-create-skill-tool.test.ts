// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AgentBuilderEditFormValues } from '../../../../schemas';
import { useCreateSkillTool } from '../use-create-skill-tool';
import { extractSkillInstructions } from '@/domains/agents/components/agent-cms-pages/skill-file-tree';

const mutateAsync = vi.fn();

vi.mock('@/domains/agents/hooks/use-create-skill', () => ({
  useCreateSkill: () => ({ mutateAsync }),
}));

vi.mock('@/domains/auth/hooks/use-default-visibility', () => ({
  useDefaultVisibility: () => 'private',
}));

const renderCreateSkillTool = (options: { availableWorkspaces?: { id: string; name: string }[] } = {}) => {
  const formRef: { current: ReturnType<typeof useForm<AgentBuilderEditFormValues>> | null } = {
    current: null,
  };

  const Wrapper = ({ children }: { children: React.ReactNode }) => {
    const methods = useForm<AgentBuilderEditFormValues>({
      defaultValues: { name: '', description: '', instructions: '', tools: {}, agents: {}, skills: {} },
    });
    formRef.current = methods;
    return React.createElement(FormProvider, methods, children);
  };

  const { result } = renderHook(() => useCreateSkillTool({ availableWorkspaces: options.availableWorkspaces }), {
    wrapper: Wrapper,
  });

  return { tool: result.current, form: () => formRef.current! };
};

describe('useCreateSkillTool', () => {
  beforeEach(() => {
    mutateAsync.mockReset();
  });

  it('creates a skill, writes SKILL.md content, and attaches it to the form', async () => {
    mutateAsync.mockResolvedValue({ id: 'skill-new' });
    const { tool, form } = renderCreateSkillTool({
      availableWorkspaces: [{ id: 'ws-1', name: 'Primary' }],
    });

    const result = await tool.execute!({
      name: 'CSV Parser',
      description: 'Parses CSV files',
      instructions: '# How to parse CSV\nUse a streaming parser.',
      workspaceId: 'ws-1',
    } as any);

    expect(mutateAsync).toHaveBeenCalledTimes(1);
    const payload = mutateAsync.mock.calls[0][0];
    expect(payload.name).toBe('CSV Parser');
    expect(payload.description).toBe('Parses CSV files');
    expect(payload.workspaceId).toBe('ws-1');
    expect(payload.visibility).toBe('private');
    expect(extractSkillInstructions(payload.files)).toBe('# How to parse CSV\nUse a streaming parser.');

    expect(result).toEqual({ success: true, skillId: 'skill-new' });
    expect(form().getValues('skills')).toEqual({ 'skill-new': true });
  });

  it('preserves previously selected skills when attaching the new one', async () => {
    mutateAsync.mockResolvedValue({ id: 'skill-new' });
    const { tool, form } = renderCreateSkillTool({
      availableWorkspaces: [{ id: 'ws-1', name: 'Primary' }],
    });

    form().setValue('skills', { 'skill-existing': true });

    await tool.execute!({
      name: 'CSV Parser',
      description: 'Parses CSV files',
      instructions: 'body',
      workspaceId: 'ws-1',
    } as any);

    expect(form().getValues('skills')).toEqual({ 'skill-existing': true, 'skill-new': true });
  });

  it('falls back to the only available workspace when workspaceId is omitted', async () => {
    mutateAsync.mockResolvedValue({ id: 'skill-new' });
    const { tool } = renderCreateSkillTool({
      availableWorkspaces: [{ id: 'ws-only', name: 'Only' }],
    });

    await tool.execute!({
      name: 'Skill',
      description: 'desc',
      instructions: 'body',
    } as any);

    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(mutateAsync.mock.calls[0][0].workspaceId).toBe('ws-only');
  });

  it('returns an error and does not call mutateAsync when no workspace is available', async () => {
    const { tool, form } = renderCreateSkillTool({ availableWorkspaces: [] });

    const result = await tool.execute!({
      name: 'Skill',
      description: 'desc',
      instructions: 'body',
    } as any);

    expect(mutateAsync).not.toHaveBeenCalled();
    expect(result).toEqual({
      success: false,
      error: 'No workspace available for skill creation.',
    });
    expect(form().getValues('skills')).toEqual({});
  });
});
