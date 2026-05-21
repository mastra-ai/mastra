// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import { describe, expect, it } from 'vitest';

import type { AgentBuilderEditFormValues } from '../../schemas';
import type { AgentTool } from '../../types/agent-tool';
import { needsConnectionSetup, useToolProvidersBridge } from '../use-tool-providers-bridge';

const baseValues = (overrides: Partial<AgentBuilderEditFormValues> = {}): AgentBuilderEditFormValues => ({
  name: 'A',
  description: '',
  instructions: 'i',
  tools: {},
  agents: {},
  workflows: {},
  skills: {},
  ...overrides,
});

const makeWrapper = (defaults: AgentBuilderEditFormValues) => {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    const methods = useForm<AgentBuilderEditFormValues>({ defaultValues: defaults });
    return <FormProvider {...methods}>{children}</FormProvider>;
  };
};

describe('useToolProvidersBridge', () => {
  it('adds an integration tool with denormalized toolkit and preserves connections', () => {
    const wrapper = makeWrapper(
      baseValues({
        toolProviders: {
          composio: {
            tools: {},
            connections: {
              gmail: [{ connectionId: 'ca_1', toolkit: 'gmail', kind: 'author', scope: 'per-author', label: 'work' }],
            },
          },
        },
      }),
    );

    const { result } = renderHook(
      () => {
        const bridge = useToolProvidersBridge();
        const value = useWatch<AgentBuilderEditFormValues>({ name: 'toolProviders' }) as
          | AgentBuilderEditFormValues['toolProviders']
          | undefined;
        return { bridge, value };
      },
      { wrapper },
    );

    act(() => {
      result.current.bridge.addIntegrationTool({
        providerId: 'composio',
        toolkit: 'gmail',
        toolSlug: 'GMAIL_FETCH_EMAILS',
        description: 'Fetch Gmail emails',
      });
    });

    const cfg = result.current.value?.composio;
    expect(cfg?.tools?.GMAIL_FETCH_EMAILS).toEqual({
      toolkit: 'gmail',
      description: 'Fetch Gmail emails',
    });
    expect(cfg?.connections?.gmail).toHaveLength(1);
    expect(cfg?.connections?.gmail?.[0].connectionId).toBe('ca_1');
  });

  it('removes an integration tool slug but leaves connections intact', () => {
    const wrapper = makeWrapper(
      baseValues({
        toolProviders: {
          composio: {
            tools: {
              GMAIL_FETCH_EMAILS: { toolkit: 'gmail' },
              GMAIL_SEND_EMAIL: { toolkit: 'gmail' },
            },
            connections: {
              gmail: [{ connectionId: 'ca_1', toolkit: 'gmail', kind: 'author', scope: 'per-author', label: 'work' }],
            },
          },
        },
      }),
    );

    const { result } = renderHook(
      () => {
        const bridge = useToolProvidersBridge();
        const value = useWatch<AgentBuilderEditFormValues>({ name: 'toolProviders' }) as
          | AgentBuilderEditFormValues['toolProviders']
          | undefined;
        return { bridge, value };
      },
      { wrapper },
    );

    act(() => {
      result.current.bridge.removeIntegrationTool({
        providerId: 'composio',
        toolSlug: 'GMAIL_FETCH_EMAILS',
      });
    });

    const cfg = result.current.value?.composio;
    expect(cfg?.tools).toEqual({ GMAIL_SEND_EMAIL: { toolkit: 'gmail' } });
    expect(cfg?.connections?.gmail).toHaveLength(1);
  });

  it('no-ops removeIntegrationTool when provider has no config', () => {
    const wrapper = makeWrapper(baseValues({ toolProviders: {} }));

    const { result } = renderHook(
      () => {
        const bridge = useToolProvidersBridge();
        const value = useWatch<AgentBuilderEditFormValues>({ name: 'toolProviders' }) as
          | AgentBuilderEditFormValues['toolProviders']
          | undefined;
        return { bridge, value };
      },
      { wrapper },
    );

    act(() => {
      result.current.bridge.removeIntegrationTool({ providerId: 'composio', toolSlug: 'X' });
    });

    expect(result.current.value).toEqual({});
  });
});

describe('needsConnectionSetup', () => {
  const integrationItem: AgentTool = {
    id: 'composio:GMAIL_FETCH_EMAILS',
    name: 'GMAIL_FETCH_EMAILS',
    isChecked: true,
    type: 'integration',
    providerId: 'composio',
    toolkit: 'gmail',
  };

  it('returns true when integration item is checked and toolkit has zero connections', () => {
    expect(needsConnectionSetup(integrationItem, { composio: { tools: {}, connections: {} } })).toBe(true);
    expect(needsConnectionSetup(integrationItem, undefined)).toBe(true);
  });

  it('returns false when toolkit has at least one pinned connection', () => {
    expect(
      needsConnectionSetup(integrationItem, {
        composio: {
          tools: {},
          connections: {
            gmail: [{ connectionId: 'ca_1', toolkit: 'gmail', kind: 'author', scope: 'per-author', label: 'work' }],
          },
        },
      }),
    ).toBe(false);
  });

  it('returns false when item is not checked', () => {
    expect(needsConnectionSetup({ ...integrationItem, isChecked: false }, undefined)).toBe(false);
  });

  it('returns false for non-integration items', () => {
    const nativeItem: AgentTool = { id: 'tool-a', name: 'tool-a', isChecked: true, type: 'tool' };
    expect(needsConnectionSetup(nativeItem, undefined)).toBe(false);
  });
});
