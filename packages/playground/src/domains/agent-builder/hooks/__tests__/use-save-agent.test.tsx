// @vitest-environment jsdom
import type * as PlaygroundUi from '@mastra/playground-ui';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentBuilderEditFormValues } from '../../schemas';
import type { AgentTool } from '../../types/agent-tool';
import { useSaveAgent } from '../use-save-agent';
import { server } from '@/test/msw-server';

vi.mock('@mastra/playground-ui', async () => {
  const actual = await vi.importActual<typeof PlaygroundUi>('@mastra/playground-ui');
  return {
    ...actual,
    toast: { success: vi.fn(), error: vi.fn() },
    usePlaygroundStore: () => ({ requestContext: undefined }),
  };
});

const BASE_URL = 'http://localhost:4111';

// Default: no admin builder configured. Tests that need a specific policy
// override this with `server.use(...)` before exercising the hook.
beforeEach(() => {
  server.use(
    http.get(`${BASE_URL}/api/editor/builder/settings`, () =>
      HttpResponse.json({ enabled: false, modelPolicy: { active: false } }),
    ),
  );
});

const renderSave = ({
  agentId,
  mode,
  availableAgentTools,
  defaultValues,
}: {
  agentId: string;
  mode: 'create' | 'edit';
  availableAgentTools: AgentTool[];
  defaultValues: AgentBuilderEditFormValues;
}) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const formRef: { current: ReturnType<typeof useForm<AgentBuilderEditFormValues>> | null } = {
    current: null,
  };

  const Wrapper = ({ children }: { children: React.ReactNode }) => {
    const methods = useForm<AgentBuilderEditFormValues>({ defaultValues });
    formRef.current = methods;
    return (
      <MastraReactProvider baseUrl={BASE_URL}>
        <QueryClientProvider client={queryClient}>
          <FormProvider {...methods}>{children}</FormProvider>
        </QueryClientProvider>
      </MastraReactProvider>
    );
  };

  const { result } = renderHook(() => useSaveAgent({ agentId, mode, availableAgentTools }), { wrapper: Wrapper });

  return { hook: result, form: () => formRef.current! };
};

describe('useSaveAgent persists tools and agents on save', () => {
  it('writes tools record and agents record on create', async () => {
    let capturedBody: any = null;
    server.use(
      http.post(`${BASE_URL}/api/stored/agents`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ id: 'created-id' });
      }),
    );

    const availableAgentTools: AgentTool[] = [
      { id: 'tool-a', name: 'tool-a', description: 'Tool A desc', isChecked: true, type: 'tool' },
      { id: 'agent-x', name: 'Agent X', description: 'Agent X desc', isChecked: true, type: 'agent' },
    ];

    const { hook } = renderSave({
      agentId: 'created-id',
      mode: 'create',
      availableAgentTools,
      defaultValues: {
        name: 'New agent',
        description: 'desc',
        instructions: 'do things',
        tools: { 'tool-a': true },
        agents: { 'agent-x': true },
        skills: {},
      },
    });

    await act(async () => {
      await hook.current.save({
        name: 'New agent',
        description: 'desc',
        instructions: 'do things',
        tools: { 'tool-a': true },
        agents: { 'agent-x': true },
        skills: {},
      });
    });

    expect(capturedBody).toBeTruthy();
    expect(capturedBody.tools).toEqual({ 'tool-a': { description: 'Tool A desc' } });
    expect(capturedBody.agents).toEqual({ 'agent-x': { description: 'Agent X desc' } });
  });

  it('writes workflows record on create', async () => {
    let capturedBody: any = null;
    server.use(
      http.post(`${BASE_URL}/api/stored/agents`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ id: 'created-id' });
      }),
    );

    const availableAgentTools: AgentTool[] = [
      { id: 'wf-1', name: 'Workflow One', description: 'Workflow desc', isChecked: true, type: 'workflow' },
    ];

    const { hook } = renderSave({
      agentId: 'created-id',
      mode: 'create',
      availableAgentTools,
      defaultValues: {
        name: 'New agent',
        description: '',
        instructions: 'do things',
        tools: {},
        agents: {},
        workflows: { 'wf-1': true },
        skills: {},
      },
    });

    await act(async () => {
      await hook.current.save({
        name: 'New agent',
        description: '',
        instructions: 'do things',
        tools: {},
        agents: {},
        workflows: { 'wf-1': true },
        skills: {},
      });
    });

    expect(capturedBody).toBeTruthy();
    expect(capturedBody.workflows).toEqual({ 'wf-1': { description: 'Workflow desc' } });
  });

  it('writes tools record and agents record on update', async () => {
    let capturedBody: any = null;
    server.use(
      http.patch(`${BASE_URL}/api/stored/agents/existing-id`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ id: 'existing-id' });
      }),
    );

    const availableAgentTools: AgentTool[] = [
      { id: 'tool-a', name: 'tool-a', isChecked: true, type: 'tool' },
      { id: 'agent-x', name: 'Agent X', isChecked: true, type: 'agent' },
    ];

    const { hook } = renderSave({
      agentId: 'existing-id',
      mode: 'edit',
      availableAgentTools,
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

    expect(capturedBody).toBeTruthy();
    expect(capturedBody.tools).toEqual({ 'tool-a': {} });
    expect(capturedBody.agents).toEqual({ 'agent-x': {} });
  });

  it('writes workflows record on update', async () => {
    let capturedBody: any = null;
    server.use(
      http.patch(`${BASE_URL}/api/stored/agents/existing-id`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ id: 'existing-id' });
      }),
    );

    const availableAgentTools: AgentTool[] = [{ id: 'wf-1', name: 'Workflow One', isChecked: true, type: 'workflow' }];

    const { hook } = renderSave({
      agentId: 'existing-id',
      mode: 'edit',
      availableAgentTools,
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

    expect(capturedBody).toBeTruthy();
    expect(capturedBody.workflows).toEqual({ 'wf-1': {} });
  });
});
