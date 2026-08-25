import type { CreateStoredSkillParams, StoredSkillFileNode } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AgentBuilderEditFormValues } from '../../schemas';
import { CREATE_SKILL_TOOL_NAME, useCreateSkillTool } from '../use-create-skill-tool';
import { authEnabledWritableCapabilities } from './fixtures/auth';
import { makeStoredSkill } from './fixtures/stored-skills';
import { extractSkillInstructions } from '@/domains/agents/components/agent-cms-pages/skill-file-tree-utils';
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
    // RHF's formState is a proxy: subscribe during render so the tool's writes
    // are tracked as dirty edits.
    void methods.formState.isDirty;
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
  describe('its schema and description', () => {
    it('requires a name, description and instructions', () => {
      const { result } = renderCreateSkillTool({ availableWorkspaces: [{ id: 'ws-1', name: 'One' }] });
      const schema = result.current.tool.inputSchema!;

      expect(schema.safeParse({ name: 'S', description: 'D', instructions: 'I' }).success).toBe(true);
      expect(schema.safeParse({ name: '', description: 'D', instructions: 'I' }).success).toBe(false);
      expect(schema.safeParse({ name: 'S', description: '', instructions: 'I' }).success).toBe(false);
      expect(schema.safeParse({ name: 'S', description: 'D', instructions: '' }).success).toBe(false);
      expect(schema.safeParse({ description: 'D', instructions: 'I' }).success).toBe(false);
    });

    it('accepts only the two visibilities', () => {
      const { result } = renderCreateSkillTool({ availableWorkspaces: [{ id: 'ws-1', name: 'One' }] });
      const base = { name: 'S', description: 'D', instructions: 'I' };
      const schema = result.current.tool.inputSchema!;

      expect(schema.safeParse({ ...base, visibility: 'private' }).success).toBe(true);
      expect(schema.safeParse({ ...base, visibility: 'public' }).success).toBe(true);
      expect(schema.safeParse({ ...base, visibility: 'unlisted' }).success).toBe(false);
    });

    it('leaves the workspace optional when only one is available', () => {
      const { result } = renderCreateSkillTool({ availableWorkspaces: [{ id: 'ws-1', name: 'One' }] });
      const base = { name: 'S', description: 'D', instructions: 'I' };
      const schema = result.current.tool.inputSchema!;

      expect(schema.safeParse(base).success).toBe(true);
      expect(schema.safeParse({ ...base, workspaceId: 'ws-1' }).success).toBe(true);
      expect(schema.safeParse({ ...base, workspaceId: 'ws-unknown' }).success).toBe(false);
    });

    it('requires the workspace once there is more than one', () => {
      const { result } = renderCreateSkillTool({
        availableWorkspaces: [
          { id: 'ws-1', name: 'One' },
          { id: 'ws-2', name: 'Two' },
        ],
      });
      const base = { name: 'S', description: 'D', instructions: 'I' };
      const schema = result.current.tool.inputSchema!;

      expect(schema.safeParse(base).success).toBe(false);
      expect(schema.safeParse({ ...base, workspaceId: 'ws-2' }).success).toBe(true);
      expect(schema.safeParse({ ...base, workspaceId: 'ws-unknown' }).success).toBe(false);
    });

    it('accepts any workspace id when none are known', () => {
      const { result } = renderCreateSkillTool();
      const base = { name: 'S', description: 'D', instructions: 'I' };
      const schema = result.current.tool.inputSchema!;

      expect(schema.safeParse(base).success).toBe(true);
      expect(schema.safeParse({ ...base, workspaceId: 'anything' }).success).toBe(true);
    });

    it('lists the available workspaces for the model', () => {
      const { result } = renderCreateSkillTool({
        availableWorkspaces: [
          { id: 'ws-1', name: 'One' },
          { id: 'ws-2', name: 'Two' },
        ],
      });

      expect(result.current.tool.description).toContain('- ws-1: One\n- ws-2: Two');
    });

    it('says nothing about workspaces when none are available', () => {
      const { result } = renderCreateSkillTool();

      // Compared whole: appending anything at all would still "not contain"
      // the workspaces heading.
      expect(result.current.tool.description).toBe(
        'Create a new stored skill and automatically attach it to the agent currently being edited. ' +
          'Provide `name`, `description`, and `instructions` (markdown body for SKILL.md). ' +
          'Optionally provide `workspaceId` (required when more than one workspace is available) and `visibility` (defaults to "private"). ' +
          "On success the new skill is added to the agent's selected skills.",
      );
    });

    it('declares the success envelope it reports back', () => {
      const { result } = renderCreateSkillTool();
      const schema = result.current.tool.outputSchema!;

      expect(schema.safeParse({ success: true, skillId: 'skill-1' }).success).toBe(true);
      expect(schema.safeParse({ success: false, error: 'nope' }).success).toBe(true);
      expect(schema.safeParse({ success: 'yes' }).success).toBe(false);
      expect(schema.safeParse({ success: true, skillId: 42 }).success).toBe(false);
      expect(schema.safeParse({}).success).toBe(false);
    });
  });

  describe('when the caller names a workspace explicitly', () => {
    it('uses it rather than the sole available one', async () => {
      seedWritableAuth();
      const writes = seedWorkspaceWrite();
      const calls = seedSkillCreate();
      const { result } = renderCreateSkillTool({
        availableWorkspaces: [
          { id: 'ws-1', name: 'One' },
          { id: 'ws-2', name: 'Two' },
        ],
      });

      await waitFor(() => expect(result.current.visibility).toBe('private'));
      await runTool(result.current.tool, {
        name: 'S',
        description: 'D',
        instructions: 'I',
        workspaceId: 'ws-2',
      });

      await waitFor(() => expect(calls).toHaveLength(1));
      // `workspaceId` is not part of the create body — it selects which workspace
      // filesystem the skill files are written to.
      expect(writes.length).toBeGreaterThan(0);
      expect(writes.every(id => id === 'ws-2')).toBe(true);
    });

    it('ignores an empty workspace id and falls back to the sole workspace', async () => {
      seedWritableAuth();
      const writes = seedWorkspaceWrite();
      const calls = seedSkillCreate();
      const { result } = renderCreateSkillTool({ availableWorkspaces: [{ id: 'ws-1', name: 'One' }] });

      await waitFor(() => expect(result.current.visibility).toBe('private'));
      await runTool(result.current.tool, { name: 'S', description: 'D', instructions: 'I', workspaceId: '' });

      await waitFor(() => expect(calls).toHaveLength(1));
      expect(writes.length).toBeGreaterThan(0);
      expect([...new Set(writes)]).toEqual(['ws-1']);
    });

    it('ignores a workspace id that is not a string, even a non-empty one', async () => {
      seedWritableAuth();
      const writes = seedWorkspaceWrite();
      const calls = seedSkillCreate();
      const { result } = renderCreateSkillTool({ availableWorkspaces: [{ id: 'ws-1', name: 'One' }] });

      await waitFor(() => expect(result.current.visibility).toBe('private'));
      // An array has a length, so only the type check keeps it out.
      await runTool(result.current.tool, {
        name: 'S',
        description: 'D',
        instructions: 'I',
        workspaceId: ['ws-9'],
      } as never);

      await waitFor(() => expect(calls).toHaveLength(1));
      expect(writes.length).toBeGreaterThan(0);
      expect([...new Set(writes)]).toEqual(['ws-1']);
    });
  });

  describe('when the caller asks for a public skill', () => {
    it('creates it public rather than falling back to the default', async () => {
      seedWritableAuth();
      seedWorkspaceWrite();
      const calls = seedSkillCreate();
      const { result } = renderCreateSkillTool({ availableWorkspaces: [{ id: 'ws-1', name: 'One' }] });

      await waitFor(() => expect(result.current.visibility).toBe('private'));
      await runTool(result.current.tool, {
        name: 'S',
        description: 'D',
        instructions: 'I',
        visibility: 'public',
      });

      await waitFor(() => expect(calls).toHaveLength(1));
      expect(calls[0]?.visibility).toBe('public');
    });
  });

  describe('when the server rejects the creation', () => {
    it('reports the failure instead of throwing at the model', async () => {
      seedWritableAuth();
      seedWorkspaceWrite();
      server.use(
        http.post(`${BASE_URL}/api/stored/skills`, () => HttpResponse.json({ message: 'boom' }, { status: 500 })),
      );
      const { result } = renderCreateSkillTool({ availableWorkspaces: [{ id: 'ws-1', name: 'One' }] });

      await waitFor(() => expect(result.current.visibility).toBe('private'));
      const output = (await runTool(result.current.tool, {
        name: 'S',
        description: 'D',
        instructions: 'I',
      })) as { success: boolean; error?: string; skillId?: string };

      expect(output.success).toBe(false);
      expect(output.error).toBeTruthy();
      expect(output.skillId).toBeUndefined();
    });

    it('leaves the form skills untouched', async () => {
      seedWritableAuth();
      seedWorkspaceWrite();
      server.use(http.post(`${BASE_URL}/api/stored/skills`, () => new HttpResponse(null, { status: 500 })));
      const { result, form } = renderCreateSkillTool({ availableWorkspaces: [{ id: 'ws-1', name: 'One' }] });

      await waitFor(() => expect(result.current.visibility).toBe('private'));
      await runTool(result.current.tool, { name: 'S', description: 'D', instructions: 'I' });

      expect(form().getValues('skills')).toEqual({});
    });
  });

  describe('what it tells the model about itself', () => {
    it('exposes the canonical tool id', () => {
      seedWritableAuth();
      const { result } = renderCreateSkillTool();

      expect(result.current.tool.id).toBe(CREATE_SKILL_TOOL_NAME);
      expect(result.current.tool.id).toBe('createSkillTool');
    });

    it('says what the tool does and which fields it needs', () => {
      seedWritableAuth();
      const { result } = renderCreateSkillTool();
      const description = result.current.tool.description ?? '';

      expect(description).toContain('Create a new stored skill');
      expect(description).toContain('attach it to the agent currently being edited');
      expect(description).toContain('`name`, `description`, and `instructions`');
      expect(description).toContain('SKILL.md');
      expect(description).toContain('required when more than one workspace is available');
      expect(description).toContain('defaults to "private"');
      expect(description).toContain("the new skill is added to the agent's selected skills");
    });
  });

  describe('when the model sends a workspace id of the wrong shape', () => {
    it.each([
      ['a number', 42],
      ['an object', { id: 'ws-1' }],
      ['null', null],
    ])('ignores %s and falls back to the sole workspace', async (_label, workspaceId) => {
      seedWritableAuth();
      seedWorkspaceWrite();
      const calls = seedSkillCreate();
      const { result } = renderCreateSkillTool({ availableWorkspaces: [{ id: 'ws-only', name: 'Only' }] });

      await act(async () => {
        await runTool(result.current.tool, {
          name: 'S',
          description: 'D',
          instructions: 'I',
          workspaceId,
        } as never);
      });

      await waitFor(() => expect(calls.length).toBe(1));
    });
  });

  describe('once the skill is attached', () => {
    it('marks the form dirty so the save button lights up', async () => {
      seedWritableAuth();
      seedWorkspaceWrite();
      seedSkillCreate();
      const { result, form } = renderCreateSkillTool({ availableWorkspaces: [{ id: 'ws-only', name: 'Only' }] });

      await act(async () => {
        await runTool(result.current.tool, { name: 'S', description: 'D', instructions: 'I' } as never);
      });

      await waitFor(() => expect(form().formState.isDirty).toBe(true));
    });
  });
});
