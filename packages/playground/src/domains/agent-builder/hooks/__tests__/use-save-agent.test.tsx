import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';
import type { AgentBuilderEditFormValues } from '../../schemas';
import type { AgentTool } from '../../types/agent-tool';
import { useSaveAgent } from '../use-save-agent';
import { authDisabledCapabilities, authEnabledCapabilities } from './fixtures/auth';
import type { AuthCapabilities } from '@/domains/auth/types';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const renderSave = ({
  agentId,
  availableAgentTools,
  defaultValues,
  capabilities = authEnabledCapabilities,
}: {
  agentId: string;
  availableAgentTools: AgentTool[];
  defaultValues: AgentBuilderEditFormValues;
  capabilities?: AuthCapabilities;
}) => {
  const captured: { body: Record<string, unknown> | null; capabilitiesLoaded: boolean } = {
    body: null,
    capabilitiesLoaded: false,
  };

  server.use(
    http.get(`${BASE_URL}/api/auth/capabilities`, () => {
      captured.capabilitiesLoaded = true;
      return HttpResponse.json(capabilities);
    }),
    http.patch(`${BASE_URL}/api/stored/agents/${agentId}`, async ({ request }) => {
      captured.body = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({ id: agentId });
    }),
  );

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  const Wrapper = ({ children }: { children: React.ReactNode }) => {
    const methods = useForm<AgentBuilderEditFormValues>({ defaultValues });
    return (
      <MastraReactProvider baseUrl={BASE_URL}>
        <QueryClientProvider client={queryClient}>
          <FormProvider {...methods}>{children}</FormProvider>
        </QueryClientProvider>
      </MastraReactProvider>
    );
  };

  const { result } = renderHook(() => useSaveAgent({ agentId, availableAgentTools }), { wrapper: Wrapper });

  return { hook: result, captured };
};

describe('useSaveAgent', () => {
  describe('when saving an agent configuration', () => {
    it('requests immediate publication', async () => {
      const { hook, captured } = renderSave({
        agentId: 'existing-id',
        availableAgentTools: [],
        defaultValues: {
          name: 'Existing',
          description: '',
          instructions: 'Updated instructions',
          tools: {},
          agents: {},
          workflows: {},
          skills: {},
        },
      });

      await act(async () => {
        await hook.current.save({
          name: 'Existing',
          description: '',
          instructions: 'Updated instructions',
          tools: {},
          agents: {},
          workflows: {},
          skills: {},
        });
      });

      expect(captured.body?.autoPublish).toBe(true);
    });
  });

  describe('when updating an agent with selected tools and agents', () => {
    it('persists the selected tools as a record', async () => {
      const { hook, captured } = renderSave({
        agentId: 'existing-id',
        availableAgentTools: [
          { id: 'tool-a', name: 'tool-a', isChecked: true, type: 'tool' },
          { id: 'agent-x', name: 'Agent X', isChecked: true, type: 'agent' },
        ],
        defaultValues: {
          name: 'Existing',
          description: '',
          instructions: 'inst',
          tools: { 'tool-a': true },
          agents: { 'agent-x': true },
          skills: {},
        },
      });

      await act(async () => {
        await hook.current.save({
          name: 'Existing',
          description: '',
          instructions: 'inst',
          tools: { 'tool-a': true },
          agents: { 'agent-x': true },
          skills: {},
        });
      });

      expect(captured.body?.tools).toEqual({ 'tool-a': {} });
    });

    it('persists the selected agents as a record', async () => {
      const { hook, captured } = renderSave({
        agentId: 'existing-id',
        availableAgentTools: [
          { id: 'tool-a', name: 'tool-a', isChecked: true, type: 'tool' },
          { id: 'agent-x', name: 'Agent X', isChecked: true, type: 'agent' },
        ],
        defaultValues: {
          name: 'Existing',
          description: '',
          instructions: 'inst',
          tools: { 'tool-a': true },
          agents: { 'agent-x': true },
          skills: {},
        },
      });

      await act(async () => {
        await hook.current.save({
          name: 'Existing',
          description: '',
          instructions: 'inst',
          tools: { 'tool-a': true },
          agents: { 'agent-x': true },
          skills: {},
        });
      });

      expect(captured.body?.agents).toEqual({ 'agent-x': {} });
    });
  });

  describe('when updating an agent with a selected workflow', () => {
    it('persists the workflow as a record', async () => {
      const { hook, captured } = renderSave({
        agentId: 'existing-id',
        availableAgentTools: [{ id: 'wf-1', name: 'Workflow One', isChecked: true, type: 'workflow' }],
        defaultValues: {
          name: 'Existing',
          description: '',
          instructions: 'inst',
          tools: {},
          agents: {},
          workflows: { 'wf-1': true },
          skills: {},
        },
      });

      await act(async () => {
        await hook.current.save({
          name: 'Existing',
          description: '',
          instructions: 'inst',
          tools: {},
          agents: {},
          workflows: { 'wf-1': true },
          skills: {},
        });
      });

      expect(captured.body?.workflows).toEqual({ 'wf-1': {} });
    });
  });

  describe('when updating an agent with a selected model', () => {
    it('persists the selected model', async () => {
      const { hook, captured } = renderSave({
        agentId: 'existing-id',
        availableAgentTools: [],
        defaultValues: {
          name: 'Existing',
          description: '',
          instructions: 'inst',
          tools: {},
          agents: {},
          workflows: {},
          skills: {},
          model: { provider: 'openai', name: 'gpt-4o' },
        },
      });

      await act(async () => {
        await hook.current.save({
          name: 'Existing',
          description: '',
          instructions: 'inst',
          tools: {},
          agents: {},
          workflows: {},
          skills: {},
          model: { provider: 'openai', name: 'gpt-4o' },
        });
      });

      expect(captured.body?.model).toEqual({ provider: 'openai', name: 'gpt-4o' });
    });
  });

  describe('when a previously-selected tool is deselected', () => {
    it('persists an empty tools record', async () => {
      const { hook, captured } = renderSave({
        agentId: 'existing-id',
        availableAgentTools: [
          { id: 'tool-a', name: 'tool-a', description: 'Tool A desc', isChecked: false, type: 'tool' },
        ],
        defaultValues: {
          name: 'Existing',
          description: '',
          instructions: 'inst',
          tools: { 'tool-a': false },
          agents: {},
          workflows: {},
          skills: {},
        },
      });

      await act(async () => {
        await hook.current.save({
          name: 'Existing',
          description: '',
          instructions: 'inst',
          tools: { 'tool-a': false },
          agents: {},
          workflows: {},
          skills: {},
        });
      });

      expect(captured.body?.tools).toEqual({});
    });
  });

  describe('when auth is enabled and the form omits an explicit visibility', () => {
    it('persists the default private visibility from auth capabilities', async () => {
      const { hook, captured } = renderSave({
        agentId: 'existing-id',
        availableAgentTools: [],
        capabilities: authEnabledCapabilities,
        defaultValues: {
          name: 'Existing',
          description: '',
          instructions: 'inst',
          tools: {},
          agents: {},
          workflows: {},
          skills: {},
        },
      });

      await waitFor(() => expect(captured.capabilitiesLoaded).toBe(true));

      await act(async () => {
        await hook.current.save({
          name: 'Existing',
          description: '',
          instructions: 'inst',
          tools: {},
          agents: {},
          workflows: {},
          skills: {},
        });
      });

      expect(captured.body?.visibility).toBe('private');
    });
  });

  describe('when auth is disabled and the form omits an explicit visibility', () => {
    it('persists the default public visibility from auth capabilities', async () => {
      const { hook, captured } = renderSave({
        agentId: 'existing-id',
        availableAgentTools: [],
        capabilities: authDisabledCapabilities,
        defaultValues: {
          name: 'Existing',
          description: '',
          instructions: 'inst',
          tools: {},
          agents: {},
          workflows: {},
          skills: {},
        },
      });

      await waitFor(() => expect(captured.capabilitiesLoaded).toBe(true));

      await act(async () => {
        await hook.current.save({
          name: 'Existing',
          description: '',
          instructions: 'inst',
          tools: {},
          agents: {},
          workflows: {},
          skills: {},
        });
      });

      expect(captured.body?.visibility).toBe('public');
    });
  });
});
