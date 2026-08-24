import { act, renderHook } from '@testing-library/react';
import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';

import type { AgentBuilderEditFormValues } from '../../schemas';
import type { AgentTool } from '../../types/agent-tool';
import { SET_AGENT_TOOLS_TOOL_NAME, useSetAgentToolsTool } from '../use-set-agent-tools-tool';

const availableAgentTools: AgentTool[] = [
  { id: 'web-search', name: 'web-search', type: 'tool', isChecked: false },
  { id: 'agent-helper', name: 'Helper Agent', type: 'agent', isChecked: false },
  { id: 'wf-build', name: 'Build Workflow', type: 'workflow', isChecked: false },
  {
    id: 'composio:GMAIL_SEND_EMAIL',
    name: 'GMAIL_SEND_EMAIL',
    type: 'integration',
    providerId: 'composio',
    toolkit: 'gmail',
    isChecked: false,
  },
];

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

const renderTool = (defaultValues?: Partial<AgentBuilderEditFormValues>, tools: AgentTool[] = availableAgentTools) => {
  const formRef: { current: ReturnType<typeof useForm<AgentBuilderEditFormValues>> | null } = { current: null };

  const Wrapper = ({ children }: { children: React.ReactNode }) => {
    const methods = useForm<AgentBuilderEditFormValues>({
      defaultValues: {
        name: '',
        description: '',
        instructions: '',
        tools: {},
        agents: {},
        workflows: {},
        ...defaultValues,
      },
    });
    formRef.current = methods;
    // RHF's formState is a proxy: a field is only tracked when it is read during
    // render, so subscribe here before the tool writes to the form.
    void methods.formState.dirtyFields;
    return React.createElement(FormProvider, methods, children);
  };

  const { result } = renderHook(() => useSetAgentToolsTool({ availableAgentTools: tools }), { wrapper: Wrapper });
  return { tool: result.current, form: () => formRef.current! };
};

describe('useSetAgentToolsTool', () => {
  it('exposes the canonical tool id', () => {
    const { tool } = renderTool();
    expect(tool.id).toBe(SET_AGENT_TOOLS_TOOL_NAME);
    expect(tool.id).toBe('set-agent-tools');
  });

  it('routes tools/agents/workflows into the correct form keys', async () => {
    const { tool, form } = renderTool();
    await runTool(tool, {
      tools: [
        { id: 'web-search', name: 'Web Search' },
        { id: 'agent-helper', name: 'Helper' },
        { id: 'wf-build', name: 'Build' },
      ],
    });

    expect(form().getValues('tools')).toEqual({ 'web-search': true });
    expect(form().getValues('agents')).toEqual({ 'agent-helper': true });
    expect(form().getValues('workflows')).toEqual({ 'wf-build': true });
  });

  it('clears all three maps when given an empty array', async () => {
    const { tool, form } = renderTool();
    form().setValue('tools', { 'web-search': true });
    form().setValue('agents', { 'agent-helper': true });
    form().setValue('workflows', { 'wf-build': true });

    await runTool(tool, { tools: [] });

    expect(form().getValues('tools')).toEqual({});
    expect(form().getValues('agents')).toEqual({});
    expect(form().getValues('workflows')).toEqual({});
  });

  it('ignores ids not present in availableAgentTools', async () => {
    const { tool, form } = renderTool();
    await runTool(tool, {
      tools: [
        { id: 'web-search', name: 'Web Search' },
        { id: 'unknown', name: 'Unknown' },
      ],
    });

    expect(form().getValues('tools')).toEqual({ 'web-search': true });
    expect(form().getValues('agents')).toEqual({});
    expect(form().getValues('workflows')).toEqual({});
  });

  it('does nothing when input is missing or not an array', async () => {
    const { tool, form } = renderTool();
    form().setValue('tools', { 'web-search': true });
    await runTool(tool, {});
    expect(form().getValues('tools')).toEqual({ 'web-search': true });
  });

  it('sets integration tools on the provider while preserving connections', async () => {
    const gmailConnections = [{ kind: 'author' as const, toolkit: 'gmail', connectionId: 'conn-1' }];
    const { tool, form } = renderTool({
      toolProviders: { composio: { tools: {}, connections: { gmail: gmailConnections } } },
    });

    await runTool(tool, { tools: [{ id: 'composio:GMAIL_SEND_EMAIL', name: 'Send Email' }] });

    expect(form().getValues('toolProviders')).toEqual({
      composio: {
        tools: { GMAIL_SEND_EMAIL: { toolkit: 'gmail' } },
        connections: { gmail: gmailConnections },
      },
    });
  });

  it('clears stale integration selections when the call omits them', async () => {
    const gmailConnections = [{ kind: 'author' as const, toolkit: 'gmail', connectionId: 'conn-1' }];
    const { tool, form } = renderTool({
      toolProviders: {
        composio: {
          tools: { GMAIL_FETCH_EMAILS: { toolkit: 'gmail' } },
          connections: { gmail: gmailConnections },
        },
      },
    });

    await runTool(tool, { tools: [{ id: 'web-search', name: 'Web Search' }] });

    expect(form().getValues('tools')).toEqual({ 'web-search': true });
    expect(form().getValues('toolProviders')).toEqual({
      composio: { tools: {}, connections: { gmail: gmailConnections } },
    });
  });
  it('survives being called with no input at all', async () => {
    const { tool, form } = renderTool();

    await expect(runTool(tool, undefined)).resolves.toEqual({ success: true });
    expect(form().getValues('tools')).toEqual({});
  });

  it('reports success back to the model', async () => {
    const { tool } = renderTool();

    await expect(runTool(tool, { tools: [{ id: 'web-search', name: 'Web Search' }] })).resolves.toEqual({
      success: true,
    });
  });

  it('marks every routed field dirty so the form knows there are unsaved edits', async () => {
    const { tool, form } = renderTool();

    await runTool(tool, {
      tools: [
        { id: 'web-search', name: 'Web Search' },
        { id: 'agent-helper', name: 'Helper' },
        { id: 'wf-build', name: 'Build' },
      ],
    });

    expect(form().formState.dirtyFields.tools).toBeTruthy();
    expect(form().formState.dirtyFields.agents).toBeTruthy();
    expect(form().formState.dirtyFields.workflows).toBeTruthy();
  });

  it('leaves a field clean when nothing routes to it', async () => {
    const { tool, form } = renderTool();

    await runTool(tool, { tools: [{ id: 'web-search', name: 'Web Search' }] });

    expect(form().formState.dirtyFields.tools).toBeTruthy();
    // `agents` was already {} and stays {}, so RHF sees no change.
    expect(form().formState.dirtyFields.agents).toBeUndefined();
  });

  it('marks the tool providers dirty when an integration is routed', async () => {
    const { tool, form } = renderTool();

    await runTool(tool, { tools: [{ id: 'composio:GMAIL_SEND_EMAIL', name: 'Send Email' }] });

    expect(form().formState.dirtyFields.toolProviders).toBeTruthy();
  });

  it('ignores a tools value that is not an array', async () => {
    const { tool, form } = renderTool();
    await runTool(tool, { tools: [{ id: 'web-search', name: 'Web Search' }] });

    await runTool(tool, { tools: 'web-search' });

    expect(form().getValues('tools')).toEqual({ 'web-search': true });
  });

  it('lists the available tools in the description the model reads', () => {
    const { tool } = renderTool();

    expect(tool.description).toContain('Set the tools, agents, and workflows enabled on the agent');
    expect(tool.description).toContain('- web-search');
    expect(tool.description).toContain('- agent-helper');
  });

  it('lists each tool on its own line', () => {
    const { tool } = renderTool();

    expect(tool.description).toContain('- web-search\n- agent-helper');
  });

  it('appends a tool description after a colon when there is one', () => {
    const { tool } = renderTool(undefined, [
      { id: 'web-search', name: 'web-search', type: 'tool', isChecked: false, description: 'Searches the web' },
    ]);

    expect(tool.description).toContain('- web-search: Searches the web');
  });

  it('says nothing about tools when none are available', () => {
    const { tool } = renderTool(undefined, []);

    expect(tool.description).toBe(
      'Set the tools, agents, and workflows enabled on the agent. Each entry MUST include both `id` (from the ' +
        'available tools list) and `name` (a concise Title Case display label, e.g. "Web Search"). The `name` is ' +
        'shown to the user in chat.',
    );
  });

  it('restricts the input schema to the available tool ids', () => {
    const { tool } = renderTool();

    expect(tool.inputSchema!.safeParse({ tools: [{ id: 'web-search', name: 'Web Search' }] }).success).toBe(true);
    expect(tool.inputSchema!.safeParse({ tools: [{ id: 'unknown', name: 'Unknown' }] }).success).toBe(false);
    expect(tool.inputSchema!.safeParse({}).success).toBe(false);
  });

  it('requires a non-empty display name on every entry', () => {
    const { tool } = renderTool();

    expect(tool.inputSchema!.safeParse({ tools: [{ id: 'web-search', name: '' }] }).success).toBe(false);
    expect(tool.inputSchema!.safeParse({ tools: [{ id: 'web-search' }] }).success).toBe(false);
  });

  it('accepts any id when no tools are known', () => {
    const { tool } = renderTool(undefined, []);

    expect(tool.inputSchema!.safeParse({ tools: [{ id: 'anything', name: 'Anything' }] }).success).toBe(true);
  });

  it('documents the tools field and each entry for the model', () => {
    const { tool } = renderTool();
    const entry = (tool.inputSchema as { shape: { tools: { element: unknown } } }).shape.tools.element;

    expect(fieldDescription(tool.inputSchema, 'tools')).toContain('Tools to enable on the agent');
    expect(fieldDescription(entry, 'id')).toContain('available tools list');
    expect(fieldDescription(entry, 'name')).toContain('Title Case');
  });

  it('declares a boolean success in its output schema', () => {
    const { tool } = renderTool();

    expect(tool.outputSchema!.safeParse({ success: true }).success).toBe(true);
    expect(tool.outputSchema!.safeParse({ success: 'yes' }).success).toBe(false);
    expect(tool.outputSchema!.safeParse({}).success).toBe(false);
  });

  it('gives a provider it has never seen before an empty connections map', async () => {
    const { tool, form } = renderTool();

    await runTool(tool, { tools: [{ id: 'composio:GMAIL_SEND_EMAIL', name: 'GMAIL_SEND_EMAIL' }] });

    // The form schema expects both maps on every provider entry; writing only
    // `tools` would leave the entry half-built.
    expect(form().getValues('toolProviders')?.composio).toEqual({
      tools: { GMAIL_SEND_EMAIL: { toolkit: 'gmail' } },
      connections: {},
    });
  });

  it('keeps the connections already pinned on a provider it rewrites', async () => {
    const { tool, form } = renderTool({
      toolProviders: {
        composio: {
          tools: {},
          connections: { gmail: [{ kind: 'author', toolkit: 'gmail', connectionId: 'conn-1', scope: 'per-author' }] },
        },
      },
    });

    await runTool(tool, { tools: [{ id: 'composio:GMAIL_SEND_EMAIL', name: 'GMAIL_SEND_EMAIL' }] });

    expect(form().getValues('toolProviders')?.composio.connections?.gmail).toHaveLength(1);
  });

  it('rebuilds itself when the available tools change', async () => {
    const formRef: { current: ReturnType<typeof useForm<AgentBuilderEditFormValues>> | null } = { current: null };

    const Wrapper = ({ children }: { children: React.ReactNode }) => {
      const methods = useForm<AgentBuilderEditFormValues>({ defaultValues: { name: '' } });
      formRef.current = methods;
      return React.createElement(FormProvider, methods, children);
    };

    const { result, rerender } = renderHook(
      ({ tools }: { tools: AgentTool[] }) => useSetAgentToolsTool({ availableAgentTools: tools }),
      { wrapper: Wrapper, initialProps: { tools: availableAgentTools } },
    );

    expect(result.current.description).toContain('web-search');

    rerender({ tools: [{ id: 'calendar', name: 'calendar', type: 'tool', isChecked: false }] });

    expect(result.current.description).toContain('calendar');
    expect(result.current.description).not.toContain('web-search');
  });
});
