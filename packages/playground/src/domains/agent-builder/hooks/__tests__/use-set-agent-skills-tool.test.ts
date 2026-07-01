import type { StoredSkillResponse } from '@mastra/client-js';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';

import type { AgentBuilderEditFormValues } from '../../schemas';
import { SET_AGENT_SKILLS_TOOL_NAME, useSetAgentSkillsTool } from '../use-set-agent-skills-tool';

const availableSkills = [
  { id: 'skill-1', name: 'Skill One', description: 'first' },
  { id: 'skill-2', name: 'Skill Two', description: 'second' },
] as unknown as StoredSkillResponse[];

const renderTool = (skills: StoredSkillResponse[] = availableSkills) => {
  const formRef: { current: ReturnType<typeof useForm<AgentBuilderEditFormValues>> | null } = { current: null };

  const Wrapper = ({ children }: { children: React.ReactNode }) => {
    const methods = useForm<AgentBuilderEditFormValues>({
      defaultValues: { name: '', description: '', instructions: '', skills: {} },
    });
    formRef.current = methods;
    return React.createElement(FormProvider, methods, children);
  };

  const { result } = renderHook(() => useSetAgentSkillsTool({ availableSkills: skills }), { wrapper: Wrapper });
  return { tool: result.current, form: () => formRef.current! };
};

describe('useSetAgentSkillsTool', () => {
  it('exposes the canonical tool id', () => {
    const { tool } = renderTool();
    expect(tool.id).toBe(SET_AGENT_SKILLS_TOOL_NAME);
    expect(tool.id).toBe('set-agent-skills');
  });

  it('writes only skills present in availableSkills', async () => {
    const { tool, form } = renderTool();
    await tool.execute!({
      skills: [
        { id: 'skill-1', name: 'Skill One' },
        { id: 'unknown', name: 'Unknown' },
      ],
    } as any);

    expect(form().getValues('skills')).toEqual({ 'skill-1': true });
  });

  it('clears all skills when given an empty array', async () => {
    const { tool, form } = renderTool();
    form().setValue('skills', { 'skill-1': true, 'skill-2': true });
    await tool.execute!({ skills: [] } as any);
    expect(form().getValues('skills')).toEqual({});
  });

  it('does nothing when input is missing', async () => {
    const { tool, form } = renderTool();
    form().setValue('skills', { 'skill-1': true });
    await tool.execute!({} as any);
    expect(form().getValues('skills')).toEqual({ 'skill-1': true });
  });
});
