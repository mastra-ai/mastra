import type { StoredSkillResponse } from '@mastra/client-js';
import { act, renderHook } from '@testing-library/react';
import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';

import type { AgentBuilderEditFormValues } from '../../schemas';
import { SET_AGENT_SKILLS_TOOL_NAME, useSetAgentSkillsTool } from '../use-set-agent-skills-tool';

const availableSkills = [
  { id: 'skill-1', name: 'Skill One', description: 'first' },
  { id: 'skill-2', name: 'Skill Two', description: 'second' },
] as unknown as StoredSkillResponse[];

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

const renderTool = (skills: StoredSkillResponse[] = availableSkills) => {
  const formRef: { current: ReturnType<typeof useForm<AgentBuilderEditFormValues>> | null } = { current: null };

  const Wrapper = ({ children }: { children: React.ReactNode }) => {
    const methods = useForm<AgentBuilderEditFormValues>({
      defaultValues: { name: '', description: '', instructions: '', skills: {} },
    });
    formRef.current = methods;
    // RHF's formState is a proxy: a field is only tracked when it is read during
    // render, so subscribe here before the tool writes to the form.
    void methods.formState.dirtyFields;
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
    await runTool(tool, {
      skills: [
        { id: 'skill-1', name: 'Skill One' },
        { id: 'unknown', name: 'Unknown' },
      ],
    });

    expect(form().getValues('skills')).toEqual({ 'skill-1': true });
  });

  it('clears all skills when given an empty array', async () => {
    const { tool, form } = renderTool();
    form().setValue('skills', { 'skill-1': true, 'skill-2': true });
    await runTool(tool, { skills: [] });
    expect(form().getValues('skills')).toEqual({});
  });

  it('does nothing when input is missing', async () => {
    const { tool, form } = renderTool();
    form().setValue('skills', { 'skill-1': true });
    await runTool(tool, {});
    expect(form().getValues('skills')).toEqual({ 'skill-1': true });
  });

  it('survives being called with no input at all', async () => {
    const { tool, form } = renderTool();

    await expect(runTool(tool, undefined)).resolves.toEqual({ success: true });
    expect(form().getValues('skills')).toEqual({});
  });

  it('reports success back to the model', async () => {
    const { tool } = renderTool();

    await expect(runTool(tool, { skills: [{ id: 'skill-1', name: 'Skill One' }] })).resolves.toEqual({
      success: true,
    });
  });

  it('marks the field dirty so the form knows there are unsaved edits', async () => {
    const { tool, form } = renderTool();

    await runTool(tool, { skills: [{ id: 'skill-1', name: 'Skill One' }] });

    expect(form().formState.dirtyFields.skills).toBeTruthy();
  });

  it('replaces the previous selection rather than merging into it', async () => {
    const { tool, form } = renderTool();
    await runTool(tool, { skills: [{ id: 'skill-1', name: 'Skill One' }] });

    await runTool(tool, { skills: [{ id: 'skill-2', name: 'Skill Two' }] });

    expect(form().getValues('skills')).toEqual({ 'skill-2': true });
  });

  it('ignores entries that are not objects', async () => {
    const { tool, form } = renderTool();

    await runTool(tool, { skills: ['skill-1', null, { id: 'skill-2', name: 'Skill Two' }] });

    expect(form().getValues('skills')).toEqual({ 'skill-2': true });
  });

  it('ignores entries whose id is not a string', async () => {
    const { tool, form } = renderTool();

    await runTool(tool, { skills: [{ id: 42, name: 'Nope' }] });

    expect(form().getValues('skills')).toEqual({});
  });

  it('ignores a skills value that is not an array', async () => {
    const { tool, form } = renderTool();
    await runTool(tool, { skills: [{ id: 'skill-1', name: 'Skill One' }] });

    await runTool(tool, { skills: 'skill-1' });

    expect(form().getValues('skills')).toEqual({ 'skill-1': true });
  });

  it('lists the available skills in the description the model reads', () => {
    const { tool } = renderTool();

    expect(tool.description).toContain('Attach existing skills to the agent');
    expect(tool.description).toContain('- skill-1: first');
    expect(tool.description).toContain('- skill-2: second');
  });

  it('lists each skill on its own line', () => {
    const { tool } = renderTool();

    expect(tool.description).toContain('- skill-1: first\n- skill-2: second');
  });

  it('lists a skill with no description as its bare id', () => {
    const { tool } = renderTool([{ id: 'skill-3', name: 'Skill Three' }] as unknown as StoredSkillResponse[]);

    expect(tool.description).toBe(
      'Attach existing skills to the agent. Each entry MUST include both `id` (from the available skills list) and ' +
        '`name` (a concise Title Case display label). Use the separate `createSkillTool` tool to create NEW skills.' +
        '\n\nAvailable skills (use these ids in the "skills" field):\n- skill-3',
    );
  });

  it('says nothing about skills when none are available', () => {
    const { tool } = renderTool([]);

    expect(tool.description).toBe(
      'Attach existing skills to the agent. Each entry MUST include both `id` (from the available skills list) and ' +
        '`name` (a concise Title Case display label). Use the separate `createSkillTool` tool to create NEW skills.',
    );
  });

  it('restricts the input schema to the available skill ids', () => {
    const { tool } = renderTool();

    expect(tool.inputSchema!.safeParse({ skills: [{ id: 'skill-1', name: 'One' }] }).success).toBe(true);
    expect(tool.inputSchema!.safeParse({ skills: [{ id: 'unknown', name: 'One' }] }).success).toBe(false);
    expect(tool.inputSchema!.safeParse({}).success).toBe(false);
  });

  it('requires a non-empty display name on every entry', () => {
    const { tool } = renderTool();

    expect(tool.inputSchema!.safeParse({ skills: [{ id: 'skill-1', name: '' }] }).success).toBe(false);
    expect(tool.inputSchema!.safeParse({ skills: [{ id: 'skill-1' }] }).success).toBe(false);
  });

  it('accepts any id when no skills are known', () => {
    const { tool } = renderTool([]);

    expect(tool.inputSchema!.safeParse({ skills: [{ id: 'anything', name: 'One' }] }).success).toBe(true);
  });

  it('documents the skills field for the model', () => {
    const { tool } = renderTool();

    expect(fieldDescription(tool.inputSchema, 'skills')).toContain('Skills to enable on the agent');
  });

  it('documents the id and name of each entry', () => {
    const { tool } = renderTool();
    const entry = (tool.inputSchema as { shape: { skills: { element: unknown } } }).shape.skills.element;

    expect(fieldDescription(entry, 'id')).toContain('available skills list');
    expect(fieldDescription(entry, 'name')).toContain('Title Case');
  });

  it('picks up skills that appear after the first render', async () => {
    const formRef: { current: ReturnType<typeof useForm<AgentBuilderEditFormValues>> | null } = { current: null };
    const Wrapper = ({ children }: { children: React.ReactNode }) => {
      const methods = useForm<AgentBuilderEditFormValues>({
        defaultValues: { name: '', description: '', instructions: '', skills: {} },
      });
      formRef.current = methods;
      void methods.formState.dirtyFields;
      return React.createElement(FormProvider, methods, children);
    };

    const { result, rerender } = renderHook(
      ({ skills }: { skills: StoredSkillResponse[] }) => useSetAgentSkillsTool({ availableSkills: skills }),
      {
        wrapper: Wrapper,
        initialProps: { skills: [] as StoredSkillResponse[] },
      },
    );

    rerender({ skills: availableSkills });

    await runTool(result.current, { skills: [{ id: 'skill-1', name: 'Skill One' }] });
    expect(formRef.current!.getValues('skills')).toEqual({ 'skill-1': true });
  });

  it('declares a boolean success in its output schema', () => {
    const { tool } = renderTool();

    expect(tool.outputSchema!.safeParse({ success: true }).success).toBe(true);
    expect(tool.outputSchema!.safeParse({ success: 'yes' }).success).toBe(false);
    expect(tool.outputSchema!.safeParse({}).success).toBe(false);
  });
});
