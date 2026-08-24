import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AgentBuilderEditFormValues } from '../../schemas';
import type { AgentTool } from '../../types/agent-tool';
import { useSaveAgent } from '../use-save-agent';
import { authDisabledCapabilities, authEnabledCapabilities } from './fixtures/auth';
import type { AuthCapabilities } from '@/domains/auth/types';
import { server } from '@/test/msw-server';

vi.mock('@mastra/playground-ui/utils/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const { toast } = await import('@mastra/playground-ui/utils/toast');

const baseValues: AgentBuilderEditFormValues = {
  name: 'Existing',
  description: '',
  instructions: 'inst',
  tools: {},
  agents: {},
  workflows: {},
  skills: {},
};

const BASE_URL = 'http://localhost:4111';

const renderSave = ({
  agentId,
  availableAgentTools,
  defaultValues,
  capabilities = authEnabledCapabilities,
  silent,
  onSuccess,
  patchStatus = 200,
  patchBody,
}: {
  agentId: string;
  availableAgentTools: AgentTool[];
  defaultValues: AgentBuilderEditFormValues;
  capabilities?: AuthCapabilities;
  silent?: boolean;
  onSuccess?: (agentId: string) => void;
  patchStatus?: number;
  patchBody?: unknown;
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
      if (patchStatus !== 200) {
        return HttpResponse.json((patchBody ?? {}) as Record<string, unknown>, { status: patchStatus });
      }
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

  const { result } = renderHook(() => useSaveAgent({ agentId, availableAgentTools, silent, onSuccess }), {
    wrapper: Wrapper,
  });

  return { hook: result, captured };
};

describe('useSaveAgent', () => {
  afterEach(() => vi.clearAllMocks());

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
  describe('optional fields', () => {
    it('omits workspace, metadata and toolProviders when the form produced none', async () => {
      const { hook, captured } = renderSave({
        agentId: 'existing-id',
        availableAgentTools: [],
        defaultValues: baseValues,
      });

      await act(async () => {
        await hook.current.save(baseValues);
      });

      expect(captured.body).not.toHaveProperty('workspace');
      expect(captured.body).not.toHaveProperty('metadata');
      expect(captured.body).not.toHaveProperty('toolProviders');
    });

    it('always sends the browser field so it can be turned off', async () => {
      const { hook, captured } = renderSave({
        agentId: 'existing-id',
        availableAgentTools: [],
        defaultValues: baseValues,
      });

      await act(async () => {
        await hook.current.save({ ...baseValues, browserEnabled: false });
      });

      expect(captured.body).toHaveProperty('browser');
    });

    it('forwards a workspace when the form has one', async () => {
      const { hook, captured } = renderSave({
        agentId: 'existing-id',
        availableAgentTools: [],
        defaultValues: baseValues,
      });

      await act(async () => {
        await hook.current.save({ ...baseValues, workspaceId: 'workspace-1' });
      });

      expect(captured.body?.workspace).toBeDefined();
    });

    it('forwards toolProviders when the form has them', async () => {
      const gmail: AgentTool = {
        id: 'composio:GMAIL_SEND',
        name: 'GMAIL_SEND',
        isChecked: true,
        type: 'integration',
        providerId: 'composio',
        toolkit: 'gmail',
      };
      const { hook, captured } = renderSave({
        agentId: 'existing-id',
        availableAgentTools: [gmail],
        defaultValues: baseValues,
      });

      await act(async () => {
        await hook.current.save({
          ...baseValues,
          toolProviders: { composio: { tools: { GMAIL_SEND: { toolkit: 'gmail' } }, connections: {} } },
        });
      });

      expect(captured.body?.toolProviders).toBeDefined();
    });
  });

  describe('feedback and callbacks', () => {
    it('confirms the save and reports the agent id', async () => {
      const onSuccess = vi.fn();
      const { hook } = renderSave({
        agentId: 'existing-id',
        availableAgentTools: [],
        defaultValues: baseValues,
        onSuccess,
      });

      await act(async () => {
        await hook.current.save(baseValues);
      });

      expect(toast.success).toHaveBeenCalledWith('Agent updated');
      expect(onSuccess).toHaveBeenCalledWith('existing-id');
    });

    it('stays quiet when the caller asked for a silent save', async () => {
      const onSuccess = vi.fn();
      const { hook } = renderSave({
        agentId: 'existing-id',
        availableAgentTools: [],
        defaultValues: baseValues,
        silent: true,
        onSuccess,
      });

      await act(async () => {
        await hook.current.save(baseValues);
      });

      expect(toast.success).not.toHaveBeenCalled();
      // Silent only suppresses the toast; the caller is still told.
      expect(onSuccess).toHaveBeenCalledWith('existing-id');
    });

    it('reports a generic failure and rethrows so the caller can react', async () => {
      const { hook } = renderSave({
        agentId: 'existing-id',
        availableAgentTools: [],
        defaultValues: baseValues,
        patchStatus: 500,
        patchBody: { message: 'boom' },
      });

      await act(async () => {
        await expect(hook.current.save(baseValues)).rejects.toThrow();
      });

      expect(vi.mocked(toast.error).mock.calls[0]?.[0]).toContain('Failed to save agent:');
    });

    it('surfaces the admin policy message when the model is blocked', async () => {
      const { hook } = renderSave({
        agentId: 'existing-id',
        availableAgentTools: [],
        defaultValues: baseValues,
        patchStatus: 422,
        patchBody: { error: { code: 'MODEL_NOT_ALLOWED', message: 'gpt-4o is not allowed by policy' } },
      });

      await act(async () => {
        await expect(hook.current.save(baseValues)).rejects.toThrow();
      });

      expect(toast.error).toHaveBeenCalledWith('gpt-4o is not allowed by policy');
    });

    it('does not confirm a save that failed', async () => {
      const onSuccess = vi.fn();
      const { hook } = renderSave({
        agentId: 'existing-id',
        availableAgentTools: [],
        defaultValues: baseValues,
        patchStatus: 500,
        onSuccess,
      });

      await act(async () => {
        await expect(hook.current.save(baseValues)).rejects.toThrow();
      });

      expect(toast.success).not.toHaveBeenCalled();
      expect(onSuccess).not.toHaveBeenCalled();
    });
  });
});
