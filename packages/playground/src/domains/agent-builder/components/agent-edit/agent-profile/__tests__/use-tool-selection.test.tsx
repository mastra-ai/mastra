import { act, renderHook } from '@testing-library/react';
import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';

import { useToolSelection } from '../use-tool-selection';
import type { AgentBuilderEditFormValues } from '@/domains/agent-builder/schemas';
import type { AgentTool } from '@/domains/agent-builder/types/agent-tool';

const integrationTool = (overrides: Partial<AgentTool> = {}): AgentTool => ({
  id: 'composio::GMAIL_FETCH_EMAILS',
  name: 'GMAIL_FETCH_EMAILS',
  description: 'Fetch emails from Gmail',
  isChecked: false,
  type: 'integration',
  providerId: 'composio',
  toolkit: 'gmail',
  ...overrides,
});

const nativeTool = (overrides: Partial<AgentTool> = {}): AgentTool => ({
  id: 'weather',
  name: 'weather',
  isChecked: false,
  type: 'tool',
  ...overrides,
});

const renderSelection = (defaultValues: Partial<AgentBuilderEditFormValues> = {}) => {
  const formRef: { current: ReturnType<typeof useForm<AgentBuilderEditFormValues>> | null } = { current: null };

  const Wrapper = ({ children }: { children: React.ReactNode }) => {
    const methods = useForm<AgentBuilderEditFormValues>({
      defaultValues: { name: '', description: '', instructions: '', ...defaultValues },
    });
    formRef.current = methods;
    // RHF's formState is a proxy: subscribe during render so the writes below
    // are tracked as dirty edits.
    void methods.formState.isDirty;
    void methods.formState.dirtyFields;
    return React.createElement(FormProvider, methods, children);
  };

  const { result } = renderHook(() => useToolSelection(), { wrapper: Wrapper });
  return { selection: () => result.current, form: () => formRef.current! };
};

/** Runs a form write inside `act` so the re-render flushes before assertions. */
const run = async (fn: () => void) => {
  await act(async () => {
    fn();
  });
};

describe('toggling a native tool', () => {
  it.each([
    ['a tool', 'tool', 'tools'],
    ['an agent', 'agent', 'agents'],
    ['a workflow', 'workflow', 'workflows'],
  ] as const)('routes %s to the %s map', async (_label, type, field) => {
    const { selection, form } = renderSelection();

    await run(() => selection().toggle(nativeTool({ id: 'item-1', type }), true));

    expect(form().getValues(field)).toEqual({ 'item-1': true });
  });

  it('records an unchecked item as false rather than dropping it', async () => {
    const { selection, form } = renderSelection({ tools: { weather: true } });

    await run(() => selection().toggle(nativeTool({ id: 'weather' }), false));

    expect(form().getValues('tools')).toEqual({ weather: false });
  });

  it('keeps the other selections in the same map', async () => {
    const { selection, form } = renderSelection({ tools: { weather: true } });

    await run(() => selection().toggle(nativeTool({ id: 'calendar' }), true));

    expect(form().getValues('tools')).toEqual({ weather: true, calendar: true });
  });

  it('starts a map that the form did not have yet', async () => {
    const { selection, form } = renderSelection();

    await run(() => selection().toggle(nativeTool({ id: 'weather' }), true));

    expect(form().getValues('tools')).toEqual({ weather: true });
  });

  it('marks the form dirty so the save button lights up', async () => {
    const { selection, form } = renderSelection();

    await run(() => selection().toggle(nativeTool({ id: 'weather' }), true));

    expect(form().formState.isDirty).toBe(true);
  });

  it('leaves the integration map untouched', async () => {
    const { selection, form } = renderSelection();

    await run(() => selection().toggle(nativeTool({ id: 'weather' }), true));

    expect(form().getValues('toolProviders')).toBeUndefined();
  });
});

describe('toggling an integration tool', () => {
  it('files the tool under its provider, keyed by the bare slug', async () => {
    const { selection, form } = renderSelection();

    await run(() => selection().toggle(integrationTool(), true));

    expect(form().getValues('toolProviders')).toEqual({
      composio: {
        tools: { GMAIL_FETCH_EMAILS: { toolkit: 'gmail', description: 'Fetch emails from Gmail' } },
        connections: {},
      },
    });
  });

  it('omits the description when the tool has none', async () => {
    const { selection, form } = renderSelection();

    await run(() => selection().toggle(integrationTool({ description: undefined }), true));

    expect(form().getValues('toolProviders')?.composio.tools).toEqual({ GMAIL_FETCH_EMAILS: { toolkit: 'gmail' } });
  });

  it('omits an empty description rather than storing a blank one', async () => {
    const { selection, form } = renderSelection();

    await run(() => selection().toggle(integrationTool({ description: '' }), true));

    expect(form().getValues('toolProviders')?.composio.tools.GMAIL_FETCH_EMAILS).toEqual({ toolkit: 'gmail' });
  });

  it('removes the tool on untoggle instead of leaving a false entry', async () => {
    const { selection, form } = renderSelection();

    await run(() => selection().toggle(integrationTool(), true));
    await run(() => selection().toggle(integrationTool(), false));

    expect(form().getValues('toolProviders')?.composio.tools).toEqual({});
  });

  it('keeps the other tools of the same provider', async () => {
    const { selection, form } = renderSelection();

    await run(() => selection().toggle(integrationTool(), true));
    await run(() => selection().toggle(integrationTool({ name: 'GMAIL_SEND_EMAIL', description: undefined }), true));
    await run(() => selection().toggle(integrationTool(), false));

    expect(Object.keys(form().getValues('toolProviders')!.composio.tools)).toEqual(['GMAIL_SEND_EMAIL']);
  });

  it('keeps the other providers untouched', async () => {
    const { selection, form } = renderSelection();

    await run(() => selection().toggle(integrationTool(), true));
    await run(() =>
      selection().toggle(
        integrationTool({ providerId: 'other', name: 'SLACK_POST', toolkit: 'slack', description: undefined }),
        true,
      ),
    );

    expect(Object.keys(form().getValues('toolProviders')!)).toEqual(['composio', 'other']);
  });

  it('marks the form dirty so the save button lights up', async () => {
    const { selection, form } = renderSelection();

    await run(() => selection().toggle(integrationTool(), true));

    expect(form().formState.isDirty).toBe(true);
  });

  it('survives a stored provider entry that records no connections', async () => {
    const { selection, form } = renderSelection({
      toolProviders: { composio: { tools: {} } as never },
    });

    await run(() => selection().toggle(integrationTool(), true));

    expect(form().getValues('toolProviders')?.composio.tools).toHaveProperty('GMAIL_FETCH_EMAILS');
  });

  it('routes by the row type, not by the presence of provider metadata', async () => {
    const { selection, form } = renderSelection();

    await run(() => selection().toggle(nativeTool({ id: 'weather', providerId: 'composio', toolkit: 'gmail' }), true));

    expect(form().getValues('tools')).toEqual({ weather: true });
    expect(form().getValues('toolProviders')).toBeUndefined();
  });

  it('preserves connections already pinned on the provider', async () => {
    const { selection, form } = renderSelection({
      toolProviders: {
        composio: {
          tools: {},
          connections: { gmail: [{ kind: 'author', toolkit: 'gmail', connectionId: 'conn-1', scope: 'per-author' }] },
        },
      },
    });

    await run(() => selection().toggle(integrationTool(), true));

    expect(form().getValues('toolProviders')?.composio.connections?.gmail).toHaveLength(1);
  });

  describe('when the row is missing the provider metadata', () => {
    it.each([
      ['no provider id', { providerId: undefined }],
      ['no toolkit', { toolkit: undefined }],
    ])('falls back to the native map for a row with %s', async (_label, overrides) => {
      const { selection, form } = renderSelection();

      await run(() => selection().toggle(integrationTool(overrides), true));

      expect(form().getValues('toolProviders')).toBeUndefined();
      expect(form().getValues('tools')).toEqual({ 'composio::GMAIL_FETCH_EMAILS': true });
    });
  });
});

describe('pinning a connection after OAuth', () => {
  it('checks the tool and pins the connection in one write', async () => {
    const { selection, form } = renderSelection();

    await run(() => selection().pinConnection(integrationTool(), 'conn-1'));

    expect(form().getValues('toolProviders')).toEqual({
      composio: {
        tools: { GMAIL_FETCH_EMAILS: { toolkit: 'gmail', description: 'Fetch emails from Gmail' } },
        connections: {
          gmail: [{ kind: 'author', toolkit: 'gmail', connectionId: 'conn-1', scope: 'per-author' }],
        },
      },
    });
  });

  it('leaves an already-checked tool alone rather than rewriting it', async () => {
    const { selection, form } = renderSelection({
      toolProviders: {
        composio: { tools: { GMAIL_FETCH_EMAILS: { toolkit: 'gmail', description: 'Edited label' } }, connections: {} },
      },
    });

    await run(() => selection().pinConnection(integrationTool(), 'conn-1'));

    expect(form().getValues('toolProviders')?.composio.tools.GMAIL_FETCH_EMAILS.description).toBe('Edited label');
  });

  it('marks the form dirty so the save button lights up', async () => {
    const { selection, form } = renderSelection();

    await run(() => selection().pinConnection(integrationTool(), 'conn-1'));

    expect(form().formState.isDirty).toBe(true);
  });

  it('survives a stored provider entry that records no connections', async () => {
    const { selection, form } = renderSelection({
      toolProviders: { composio: { tools: {} } as never },
    });

    await run(() => selection().pinConnection(integrationTool(), 'conn-1'));

    expect(form().getValues('toolProviders')?.composio.connections?.gmail).toHaveLength(1);
  });

  it('appends a second connection alongside the first', async () => {
    const { selection, form } = renderSelection();

    await run(() => selection().pinConnection(integrationTool(), 'conn-1'));
    await run(() => selection().pinConnection(integrationTool(), 'conn-2'));

    expect(
      form()
        .getValues('toolProviders')
        ?.composio.connections?.gmail.map(c => c.connectionId),
    ).toEqual(['conn-1', 'conn-2']);
  });

  it('does not pin the same connection twice', async () => {
    const { selection, form } = renderSelection();

    await run(() => selection().pinConnection(integrationTool(), 'conn-1'));
    await run(() => selection().pinConnection(integrationTool(), 'conn-1'));

    expect(form().getValues('toolProviders')?.composio.connections?.gmail).toHaveLength(1);
  });

  it('keeps connections pinned to another toolkit', async () => {
    const { selection, form } = renderSelection();

    await run(() => selection().pinConnection(integrationTool(), 'conn-1'));
    await run(() => selection().pinConnection(integrationTool({ toolkit: 'slack', name: 'SLACK_POST' }), 'conn-slack'));

    expect(Object.keys(form().getValues('toolProviders')!.composio.connections!)).toEqual(['gmail', 'slack']);
  });

  it('omits the description when the tool has none', async () => {
    const { selection, form } = renderSelection();

    await run(() => selection().pinConnection(integrationTool({ description: undefined }), 'conn-1'));

    expect(form().getValues('toolProviders')?.composio.tools.GMAIL_FETCH_EMAILS).toEqual({ toolkit: 'gmail' });
  });

  describe('when the row is missing the provider metadata', () => {
    it.each([
      ['no provider id', { providerId: undefined }],
      ['no toolkit', { toolkit: undefined }],
    ])('writes nothing for a row with %s', async (_label, overrides) => {
      const { selection, form } = renderSelection();

      await run(() => selection().pinConnection(integrationTool(overrides), 'conn-1'));

      expect(form().getValues('toolProviders')).toBeUndefined();
      expect(form().formState.isDirty).toBe(false);
    });
  });
});
