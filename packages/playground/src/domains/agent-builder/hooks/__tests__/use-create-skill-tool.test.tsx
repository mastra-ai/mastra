import type { CreateStoredSkillParams, StoredSkillFileNode } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AgentBuilderEditFormValues } from '../../schemas';
import { useCreateSkillTool } from '../use-create-skill-tool';
import { authEnabledWritableCapabilities } from './fixtures/auth';
import { makeStoredSkill } from './fixtures/stored-skills';
import { extractSkillInstructions } from '@/domains/agents/components/agent-cms-pages/skill-file-tree';
import type { InMemoryFileNode } from '@/domains/agents/components/agent-edit-page/utils/form-validation';
import { useDefaultVisibility } from '@/domains/auth/hooks/use-default-visibility';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

/** Auth enabled + writable so visibility defaults to `private` and writes run. */
const seedWritableAuth = () => {
  server.use(http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(authEnabledWritableCapabilities)));
};

/** Captures `POST /stored/skills` bodies; replies with the created skill. */
const seedSkillCreate = (id = 'skill-new') => {
  const calls: CreateStoredSkillParams[] = [];
  server.use(
    http.post(`${BASE_URL}/api/stored/skills`, async ({ request }) => {
      const body = (await request.json()) as CreateStoredSkillParams;
      calls.push(body);
      return HttpResponse.json(makeStoredSkill({ id, name: body.name, description: body.description }));
    }),
  );
  return calls;
};

/** Records which workspace the best-effort file writes targeted. */
const seedWorkspaceWrite = () => {
  const workspaceIds: string[] = [];
  server.use(
    http.post(`${BASE_URL}/api/workspaces/:workspaceId/fs/write`, ({ params }) => {
      workspaceIds.push(String(params.workspaceId));
      return HttpResponse.json({ success: true, path: String(params.workspaceId) });
    }),
  );
  return workspaceIds;
};

const asInMemoryFiles = (files: StoredSkillFileNode[] | undefined): InMemoryFileNode[] =>
  (files ?? []) as InMemoryFileNode[];

type SkillTool = ReturnType<typeof useCreateSkillTool>;
type SkillToolInput = Parameters<NonNullable<SkillTool['execute']>>[0];
type SkillToolContext = Parameters<NonNullable<SkillTool['execute']>>[1];

/** Invokes the tool the way the agent runtime does (input + execution context). */
const runTool = (tool: SkillTool, input: Partial<SkillToolInput>) =>
  tool.execute!(input as SkillToolInput, {} as SkillToolContext);

const renderCreateSkillTool = (options: { availableWorkspaces?: { id: string; name: string }[] } = {}) => {
  const formRef: { current: ReturnType<typeof useForm<AgentBuilderEditFormValues>> | null } = { current: null };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  const Wrapper = ({ children }: { children: ReactNode }) => {
    const methods = useForm<AgentBuilderEditFormValues>({
      defaultValues: { name: '', description: '', instructions: '', tools: {}, agents: {}, skills: {} },
    });
    formRef.current = methods;
    return (
      <MastraReactProvider baseUrl={BASE_URL}>
        <QueryClientProvider client={queryClient}>
          <FormProvider {...methods}>{children}</FormProvider>
        </QueryClientProvider>
      </MastraReactProvider>
    );
  };

  const { result } = renderHook(
    () => ({
      tool: useCreateSkillTool({ availableWorkspaces: options.availableWorkspaces }),
      visibility: useDefaultVisibility(),
    }),
    { wrapper: Wrapper },
  );

  return { result, form: () => formRef.current! };
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useCreateSkillTool', () => {
  describe('when a workspace is available', () => {
    it('creates a stored skill from the input with the default private visibility', async () => {
      seedWritableAuth();
      seedWorkspaceWrite();
      const calls = seedSkillCreate();

      const { result } = renderCreateSkillTool({ availableWorkspaces: [{ id: 'ws-1', name: 'Primary' }] });
      await waitFor(() => expect(result.current.visibility).toBe('private'));

      const outcome = await runTool(result.current.tool, {
        name: 'CSV Parser',
        description: 'Parses CSV files',
        instructions: '# How to parse CSV\nUse a streaming parser.',
        workspaceId: 'ws-1',
      });

      expect(outcome).toEqual({ success: true, skillId: 'skill-new' });
      expect(calls).toHaveLength(1);
      expect(calls[0]).toMatchObject({
        name: 'CSV Parser',
        description: 'Parses CSV files',
        visibility: 'private',
      });
      expect(extractSkillInstructions(asInMemoryFiles(calls[0].files))).toBe(
        '# How to parse CSV\nUse a streaming parser.',
      );
    });

    it('writes the new skill files to the chosen workspace', async () => {
      seedWritableAuth();
      const writes = seedWorkspaceWrite();
      seedSkillCreate();

      const { result } = renderCreateSkillTool({ availableWorkspaces: [{ id: 'ws-1', name: 'Primary' }] });
      await waitFor(() => expect(result.current.visibility).toBe('private'));

      await runTool(result.current.tool, {
        name: 'CSV Parser',
        description: 'Parses CSV files',
        instructions: 'body',
        workspaceId: 'ws-1',
      });

      expect(writes).toContain('ws-1');
    });

    it('attaches the created skill to the form', async () => {
      seedWritableAuth();
      seedWorkspaceWrite();
      seedSkillCreate();

      const { result, form } = renderCreateSkillTool({ availableWorkspaces: [{ id: 'ws-1', name: 'Primary' }] });
      await waitFor(() => expect(result.current.visibility).toBe('private'));

      await runTool(result.current.tool, {
        name: 'CSV Parser',
        description: 'Parses CSV files',
        instructions: 'body',
        workspaceId: 'ws-1',
      });

      expect(form().getValues('skills')).toEqual({ 'skill-new': true });
    });

    it('preserves previously selected skills when attaching the new one', async () => {
      seedWritableAuth();
      seedWorkspaceWrite();
      seedSkillCreate();

      const { result, form } = renderCreateSkillTool({ availableWorkspaces: [{ id: 'ws-1', name: 'Primary' }] });
      await waitFor(() => expect(result.current.visibility).toBe('private'));
      form().setValue('skills', { 'skill-existing': true });

      await runTool(result.current.tool, {
        name: 'CSV Parser',
        description: 'Parses CSV files',
        instructions: 'body',
        workspaceId: 'ws-1',
      });

      expect(form().getValues('skills')).toEqual({ 'skill-existing': true, 'skill-new': true });
    });
  });

  describe('when workspaceId is omitted and only one workspace exists', () => {
    it('falls back to the sole workspace', async () => {
      seedWritableAuth();
      const writes = seedWorkspaceWrite();
      seedSkillCreate();

      const { result } = renderCreateSkillTool({ availableWorkspaces: [{ id: 'ws-only', name: 'Only' }] });
      await waitFor(() => expect(result.current.visibility).toBe('private'));

      await runTool(result.current.tool, { name: 'Skill', description: 'desc', instructions: 'body' });

      expect(writes.length).toBeGreaterThan(0);
      expect(writes.every(id => id === 'ws-only')).toBe(true);
    });
  });

  describe('when no workspace is available', () => {
    it('returns an error without creating a skill', async () => {
      seedWritableAuth();
      const calls = seedSkillCreate();

      const { result, form } = renderCreateSkillTool({ availableWorkspaces: [] });
      await waitFor(() => expect(result.current.visibility).toBe('private'));

      const outcome = await runTool(result.current.tool, {
        name: 'Skill',
        description: 'desc',
        instructions: 'body',
      });

      expect(outcome).toEqual({ success: false, error: 'No workspace available for skill creation.' });
      expect(calls).toHaveLength(0);
      expect(form().getValues('skills')).toEqual({});
    });
  });
});
