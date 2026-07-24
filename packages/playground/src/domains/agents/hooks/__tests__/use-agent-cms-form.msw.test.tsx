import type { AgentEditorConfig } from '@mastra/core/agent';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createInstructionBlock } from '../../components/agent-edit-page/utils/form-validation';
import type { AgentDataSource } from '../../utils/compute-agent-initial-values';
import { useAgentCmsForm } from '../use-agent-cms-form';
import { createdCodeAgent, promptBlock, storedPromptBlockList } from './fixtures/use-agent-cms-form';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const AGENT_ID = 'code-override-editable';

const makeWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
};

// A code-defined agent loaded into the edit form (the data source the agent page
// builds from `GET /agents/:id`).
const dataSource: AgentDataSource = {
  name: 'Code Override Editable',
  instructions: 'Original code instructions for editable override agent.',
  model: { provider: 'openai', name: '__AI_SDK_OPENAI_MODEL_BASE__' },
};

/** Capture the body of the create-stored-agent request the save flow sends. */
const captureCreateBody = (sink: { body: Record<string, unknown> | null }) =>
  server.use(
    http.post(`${BASE_URL}/api/stored/agents`, async ({ request }) => {
      sink.body = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json(createdCodeAgent);
    }),
  );

afterEach(() => cleanup());

// Regression coverage: saving a code-defined agent must persist the edited
// instructions instead of sending an empty array that wipes the prompt.
describe('useAgentCmsForm — code agent instruction ownership', () => {
  it('persists edited instructions when the code agent has no editor config', async () => {
    const sink: { body: Record<string, unknown> | null } = { body: null };
    captureCreateBody(sink);

    const { result } = renderHook(
      () =>
        useAgentCmsForm({
          mode: 'edit',
          agentId: AGENT_ID,
          dataSource,
          isCodeAgentOverride: true,
          hasStoredOverride: false,
          editorConfig: undefined,
          onSuccess: () => {},
        }),
      { wrapper: makeWrapper() },
    );

    act(() => {
      result.current.form.setValue('instructionBlocks', [createInstructionBlock('User edited prompt')], {
        shouldDirty: true,
      });
    });

    await act(async () => {
      await result.current.handleSaveDraft();
    });

    await waitFor(() => expect(sink.body).not.toBeNull());

    // The edited block is on the wire — not the empty array that caused the wipe.
    expect(sink.body!.instructions).toEqual([{ type: 'prompt_block', content: 'User edited prompt' }]);
  });

  it('still locks instructions when the editor config sets instructions:false', async () => {
    const sink: { body: Record<string, unknown> | null } = { body: null };
    captureCreateBody(sink);

    const { result } = renderHook(
      () =>
        useAgentCmsForm({
          mode: 'edit',
          agentId: AGENT_ID,
          dataSource,
          isCodeAgentOverride: true,
          hasStoredOverride: false,
          editorConfig: { instructions: false },
          onSuccess: () => {},
        }),
      { wrapper: makeWrapper() },
    );

    act(() => {
      result.current.form.setValue('instructionBlocks', [createInstructionBlock('User edited prompt')], {
        shouldDirty: true,
      });
    });

    await act(async () => {
      await result.current.handleSaveDraft();
    });

    await waitFor(() => expect(sink.body).not.toBeNull());

    // Explicitly locked instructions are not sent; the server keeps the code value.
    expect(sink.body!.instructions).toEqual([]);
  });

  it('does not send instructions when the editor config omits instructions', async () => {
    const sink: { body: Record<string, unknown> | null } = { body: null };
    captureCreateBody(sink);

    const { result } = renderHook(
      () =>
        useAgentCmsForm({
          mode: 'edit',
          agentId: AGENT_ID,
          dataSource,
          isCodeAgentOverride: true,
          hasStoredOverride: false,
          // Owns tools but says nothing about instructions.
          editorConfig: { tools: true },
          onSuccess: () => {},
        }),
      { wrapper: makeWrapper() },
    );

    act(() => {
      result.current.form.setValue('instructionBlocks', [createInstructionBlock('User edited prompt')], {
        shouldDirty: true,
      });
    });

    await act(async () => {
      await result.current.handleSaveDraft();
    });

    await waitFor(() => expect(sink.body).not.toBeNull());

    // Mirrors the server's getCodeAgentOwnership: an editor object only owns instructions when it
    // sets `instructions: true`. Omitting the key must not send instructions the server would strip.
    expect(sink.body!.instructions).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Empty-runtime guard: block saving an agent whose instructions would resolve
// to an empty prompt at runtime because every referenced block is unpublished.
// ---------------------------------------------------------------------------

const GUARD_AGENT_ID = 'agent-under-edit';

const makeGuardWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
  return { wrapper, queryClient };
};

/** Resolves once the `useStoredPromptBlocks` query has data in the cache. */
const waitForPromptBlocksLoaded = async (queryClient: QueryClient) => {
  await waitFor(() => {
    const queries = queryClient.getQueryCache().findAll({ queryKey: ['stored-prompt-blocks'] });
    expect(queries.some(q => q.state.data !== undefined)).toBe(true);
  });
};

// Module-level constants on purpose: `useAgentCmsForm` keys its `initialValues`
// memo and form-reset effect on the `dataSource` reference, so a fresh object
// per render would retrigger the reset effect in a loop.
const dataSourceWithRef = (promptBlockId: string): AgentDataSource => ({
  name: 'Support Agent',
  model: { provider: 'test-provider', name: 'test-model' },
  instructions: [{ type: 'prompt_block_ref', id: promptBlockId }],
});

const DRAFT_REF_DATA_SOURCE = dataSourceWithRef('draft-block');
const PUBLISHED_REF_DATA_SOURCE = dataSourceWithRef('live-block');

describe('useAgentCmsForm — empty-runtime guard', () => {
  it('blocks saving a draft when every referenced prompt block is unpublished', async () => {
    let patchCalled = false;
    server.use(
      http.get(`${BASE_URL}/api/stored/prompt-blocks`, () =>
        // Draft block — no activeVersionId, so runtime would skip it.
        HttpResponse.json(storedPromptBlockList([promptBlock({ id: 'draft-block', status: 'draft' })])),
      ),
      http.patch(`${BASE_URL}/api/stored/agents/${GUARD_AGENT_ID}`, () => {
        patchCalled = true;
        return HttpResponse.json({ id: GUARD_AGENT_ID });
      }),
    );

    const { wrapper, queryClient } = makeGuardWrapper();
    const { result } = renderHook(
      () =>
        useAgentCmsForm({
          mode: 'edit',
          agentId: GUARD_AGENT_ID,
          dataSource: DRAFT_REF_DATA_SOURCE,
          onSuccess: () => {},
        }),
      { wrapper },
    );

    // Wait until the prompt block list has loaded so the guard can see the draft.
    await waitFor(() => {
      expect(result.current.form.getValues('instructionBlocks')).toHaveLength(1);
    });
    await waitForPromptBlocksLoaded(queryClient);

    await act(async () => {
      await result.current.handleSaveDraft();
    });

    // The save must be blocked — no agent update request goes out.
    expect(patchCalled).toBe(false);
  });

  it('blocks saving before the prompt block list has loaded by resolving the ref on demand', async () => {
    let patchCalled = false;
    let detailsFetched = false;
    server.use(
      // The list never resolves — simulates saving right after the form mounts,
      // before `useStoredPromptBlocks` has settled.
      http.get(`${BASE_URL}/api/stored/prompt-blocks`, async () => {
        await delay('infinite');
        return HttpResponse.json(storedPromptBlockList([]));
      }),
      // The guard falls back to an on-demand lookup, which resolves the ref to an
      // unpublished draft.
      http.get(`${BASE_URL}/api/stored/prompt-blocks/draft-block`, () => {
        detailsFetched = true;
        return HttpResponse.json(promptBlock({ id: 'draft-block', status: 'draft' }));
      }),
      http.patch(`${BASE_URL}/api/stored/agents/${GUARD_AGENT_ID}`, () => {
        patchCalled = true;
        return HttpResponse.json({ id: GUARD_AGENT_ID });
      }),
    );

    const { wrapper } = makeGuardWrapper();
    const { result } = renderHook(
      () =>
        useAgentCmsForm({
          mode: 'edit',
          agentId: GUARD_AGENT_ID,
          dataSource: DRAFT_REF_DATA_SOURCE,
          onSuccess: () => {},
        }),
      { wrapper },
    );

    // Save as soon as the form has the ref — deliberately without waiting for the
    // prompt block list to load.
    await waitFor(() => {
      expect(result.current.form.getValues('instructionBlocks')).toHaveLength(1);
    });

    await act(async () => {
      await result.current.handleSaveDraft();
    });

    // The guard resolved the ref on demand and blocked the save.
    expect(detailsFetched).toBe(true);
    expect(patchCalled).toBe(false);
  });

  it('allows saving when at least one referenced prompt block is published', async () => {
    let patchCalled = false;
    server.use(
      http.get(`${BASE_URL}/api/stored/prompt-blocks`, () =>
        // Published block — has an active version, so runtime keeps it.
        HttpResponse.json(
          storedPromptBlockList([promptBlock({ id: 'live-block', status: 'published', activeVersionId: 'v1' })]),
        ),
      ),
      http.patch(`${BASE_URL}/api/stored/agents/${GUARD_AGENT_ID}`, () => {
        patchCalled = true;
        return HttpResponse.json({ id: GUARD_AGENT_ID });
      }),
    );

    const { wrapper, queryClient } = makeGuardWrapper();
    const { result } = renderHook(
      () =>
        useAgentCmsForm({
          mode: 'edit',
          agentId: GUARD_AGENT_ID,
          dataSource: PUBLISHED_REF_DATA_SOURCE,
          onSuccess: () => {},
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.form.getValues('instructionBlocks')).toHaveLength(1);
    });
    await waitForPromptBlocksLoaded(queryClient);

    await act(async () => {
      await result.current.handleSaveDraft();
    });

    await waitFor(() => {
      expect(patchCalled).toBe(true);
    });
  });

  it('blocks publishing the current draft when every referenced prompt block is unpublished', async () => {
    let activateCalled = false;
    server.use(
      http.get(`${BASE_URL}/api/stored/prompt-blocks`, () =>
        HttpResponse.json(storedPromptBlockList([promptBlock({ id: 'draft-block', status: 'draft' })])),
      ),
      http.post(`${BASE_URL}/api/stored/agents/${GUARD_AGENT_ID}/versions/:versionId/activate`, () => {
        activateCalled = true;
        return HttpResponse.json({ id: GUARD_AGENT_ID });
      }),
    );

    const { wrapper, queryClient } = makeGuardWrapper();
    const { result } = renderHook(
      () =>
        useAgentCmsForm({
          mode: 'edit',
          agentId: GUARD_AGENT_ID,
          dataSource: DRAFT_REF_DATA_SOURCE,
          onSuccess: () => {},
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.form.getValues('instructionBlocks')).toHaveLength(1);
    });
    await waitForPromptBlocksLoaded(queryClient);

    await act(async () => {
      await result.current.handlePublish();
    });

    // The guard blocks the publish before any version is activated.
    expect(activateCalled).toBe(false);
  });

  it('still activates a specific version even when every referenced block is unpublished', async () => {
    let activatedVersionId: string | undefined;
    const onSuccess = vi.fn();
    server.use(
      http.get(`${BASE_URL}/api/stored/prompt-blocks`, () =>
        HttpResponse.json(storedPromptBlockList([promptBlock({ id: 'draft-block', status: 'draft' })])),
      ),
      http.post(`${BASE_URL}/api/stored/agents/${GUARD_AGENT_ID}/versions/:versionId/activate`, ({ params }) => {
        activatedVersionId = params.versionId as string;
        return HttpResponse.json({ id: GUARD_AGENT_ID });
      }),
    );

    const { wrapper } = makeGuardWrapper();
    const { result } = renderHook(
      () =>
        useAgentCmsForm({
          mode: 'edit',
          agentId: GUARD_AGENT_ID,
          dataSource: DRAFT_REF_DATA_SOURCE,
          onSuccess,
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.form.getValues('instructionBlocks')).toHaveLength(1);
    });

    await act(async () => {
      await result.current.handlePublish('version-1');
    });

    // Activating an existing version is read-only, so the draft guard does not
    // apply — the version is activated and the success callback fires.
    expect(activatedVersionId).toBe('version-1');
    expect(onSuccess).toHaveBeenCalledWith(GUARD_AGENT_ID);
  });
});

const EDITED_TOOL = { 'get-weather': { description: 'Get the current weather for a city' } };

/** Render the hook for a code-agent override with the given editor config, set a tool edit, save. */
const saveWithEditedTool = async (editorConfig: AgentEditorConfig | undefined) => {
  const sink: { body: Record<string, unknown> | null } = { body: null };
  captureCreateBody(sink);

  const { result } = renderHook(
    () =>
      useAgentCmsForm({
        mode: 'edit',
        agentId: AGENT_ID,
        dataSource,
        isCodeAgentOverride: true,
        hasStoredOverride: false,
        editorConfig,
        onSuccess: () => {},
      }),
    { wrapper: makeWrapper() },
  );

  act(() => {
    // Keep instructions valid (so form.trigger passes) and add a tool edit.
    result.current.form.setValue('instructionBlocks', [createInstructionBlock('Original code instructions')], {
      shouldDirty: true,
    });
    result.current.form.setValue('tools', EDITED_TOOL, { shouldDirty: true });
  });

  await act(async () => {
    await result.current.handleSaveDraft();
  });

  await waitFor(() => expect(sink.body).not.toBeNull());
  return sink.body!;
};

// Regression coverage: saving a code-defined agent must persist tool edits instead of dropping them
// when the agent has no explicit editor config. Mirrors the server's getCodeAgentOwnership for tools.
describe('useAgentCmsForm — code agent tool ownership', () => {
  it('sends tool edits when the code agent has no editor config', async () => {
    const body = await saveWithEditedTool(undefined);

    // The edited tool is on the wire — previously the whole tools block was omitted,
    // so the server never received (and silently dropped) the change.
    expect(body.tools).toEqual(EDITED_TOOL);
  });

  it('sends tool edits when editor.tools is true', async () => {
    const body = await saveWithEditedTool({ tools: true });

    expect(body.tools).toEqual(EDITED_TOOL);
  });

  it('sends tool edits when editor owns tool descriptions only', async () => {
    const body = await saveWithEditedTool({ tools: { description: true } });

    // Description-only ownership still sends the tools block so the server can apply
    // the description override (it rejects membership changes in this mode).
    expect(body.tools).toEqual(EDITED_TOOL);
  });

  it('does not send tools when the editor object omits the tools key', async () => {
    const body = await saveWithEditedTool({ instructions: true });

    // An editor object that says nothing about tools does not own them — the tools block
    // must be omitted so the server keeps the code-defined tools.
    expect(body.tools).toBeUndefined();
    expect(body.integrationTools).toBeUndefined();
    expect(body.mcpClients).toBeUndefined();
  });

  it('does not send tools when editor is false', async () => {
    const body = await saveWithEditedTool(false);

    expect(body.tools).toBeUndefined();
    expect(body.integrationTools).toBeUndefined();
    expect(body.mcpClients).toBeUndefined();
  });
});
