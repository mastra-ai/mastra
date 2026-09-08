import type { AgentEditorConfig } from '@mastra/core/agent';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));

vi.mock('@mastra/playground-ui/utils/toast', () => ({
  toast: { error: toastError, success: vi.fn() },
}));

import { promptBlock } from '../../components/__tests__/fixtures/prompt-blocks';
import {
  createInstructionBlock,
  createRefInstructionBlock,
} from '../../components/agent-edit-page/utils/form-validation';
import type { AgentDataSource } from '../../utils/compute-agent-initial-values';
import { useAgentCmsForm } from '../use-agent-cms-form';
import { useAgentVersions } from '../use-agent-versions';
import { createdCodeAgent, noAgentVersions, oneUnpublishedAgentVersion } from './fixtures/use-agent-cms-form';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const AGENT_ID = 'code-override-editable';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

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
      const body: unknown = await request.json();
      if (!isRecord(body)) throw new Error('Expected create-stored-agent request body to be an object');
      sink.body = body;
      return HttpResponse.json(createdCodeAgent);
    }),
  );

afterEach(() => {
  cleanup();
  toastError.mockReset();
});

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

describe('useAgentCmsForm — blocksWouldPreventSave guard', () => {
  describe('when a referenced block is draft-only', () => {
    it('blocks save and names the unpublished block', async () => {
      const sink: { body: Record<string, unknown> | null } = { body: null };
      captureCreateBody(sink);

      server.use(
        http.get(`${BASE_URL}/api/stored/prompt-blocks/draft-block`, () =>
          HttpResponse.json(promptBlock({ id: 'draft-block', name: 'Draft Block', status: 'draft' })),
        ),
      );

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
        result.current.form.setValue('instructionBlocks', [createRefInstructionBlock('draft-block')], {
          shouldDirty: true,
        });
      });

      await act(async () => {
        await result.current.handleSaveDraft();
      });

      // The save was blocked — no create request was sent
      expect(sink.body).toBeNull();
      expect(toastError).toHaveBeenCalledWith(
        'Unable to use unpublished referenced prompt block: draft-block. Publish these prompt blocks and try again.',
      );
    });
  });

  describe('when a draft reference has inline content beside it', () => {
    it('blocks save and names the unpublished block', async () => {
      const sink: { body: Record<string, unknown> | null } = { body: null };
      captureCreateBody(sink);

      server.use(
        http.get(`${BASE_URL}/api/stored/prompt-blocks/draft-block`, () =>
          HttpResponse.json(promptBlock({ id: 'draft-block', name: 'Draft Block', status: 'draft' })),
        ),
      );

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
        result.current.form.setValue(
          'instructionBlocks',
          [createRefInstructionBlock('draft-block'), createInstructionBlock('Inline guidance.')],
          { shouldDirty: true },
        );
      });

      await act(async () => {
        await result.current.handleSaveDraft();
      });

      expect(sink.body).toBeNull();
      expect(toastError).toHaveBeenCalledWith(
        'Unable to use unpublished referenced prompt block: draft-block. Publish these prompt blocks and try again.',
      );
    });
  });

  describe('when all referenced blocks are published', () => {
    it('allows save', async () => {
      const sink: { body: Record<string, unknown> | null } = { body: null };
      captureCreateBody(sink);

      server.use(
        http.get(`${BASE_URL}/api/stored/prompt-blocks/published-block`, () =>
          HttpResponse.json(
            promptBlock({ id: 'published-block', name: 'Published Block', status: 'published', activeVersionId: 'v1' }),
          ),
        ),
      );

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
        result.current.form.setValue(
          'instructionBlocks',
          [createRefInstructionBlock('published-block'), createInstructionBlock('Inline guidance.')],
          {
            shouldDirty: true,
          },
        );
      });

      await act(async () => {
        await result.current.handleSaveDraft();
      });

      await waitFor(() => expect(sink.body).not.toBeNull());
      expect(sink.body!.instructions).toBeDefined();
    });
  });

  describe('when a referenced block returns 404', () => {
    it('blocks save and names the missing block', async () => {
      const sink: { body: Record<string, unknown> | null } = { body: null };
      captureCreateBody(sink);

      server.use(
        http.get(`${BASE_URL}/api/stored/prompt-blocks/missing-block`, () => HttpResponse.json(null, { status: 404 })),
      );

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
        result.current.form.setValue('instructionBlocks', [createRefInstructionBlock('missing-block')], {
          shouldDirty: true,
        });
      });

      await act(async () => {
        await result.current.handleSaveDraft();
      });

      // The save was blocked — no create request was sent
      expect(sink.body).toBeNull();
      expect(toastError).toHaveBeenCalledWith(
        'Unable to verify referenced prompt block: missing-block. Resolve these references or try again before continuing.',
      );
    });
  });

  describe('when a referenced block returns 500', () => {
    it('blocks save', async () => {
      const sink: { body: Record<string, unknown> | null } = { body: null };
      captureCreateBody(sink);

      server.use(
        http.get(`${BASE_URL}/api/stored/prompt-blocks/error-block`, () => HttpResponse.json(null, { status: 500 })),
      );

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
        result.current.form.setValue('instructionBlocks', [createRefInstructionBlock('error-block')], {
          shouldDirty: true,
        });
      });

      await act(async () => {
        await result.current.handleSaveDraft();
      });

      // The save was blocked — no create request was sent — and the failure
      // was reported as an unresolved reference.
      expect(sink.body).toBeNull();
      expect(toastError).toHaveBeenCalledWith(
        'Unable to verify referenced prompt block: error-block. Resolve these references or try again before continuing.',
      );
    });
  });

  describe('when publishing a specific version', () => {
    it('does not block publish for a draft reference', async () => {
      const sink: { body: Record<string, unknown> | null } = { body: null };
      captureCreateBody(sink);

      let activationRequested = false;
      server.use(
        http.post(`${BASE_URL}/api/stored/agents/${AGENT_ID}/versions/v1/activate`, () => {
          activationRequested = true;
          return HttpResponse.json({ success: true, message: 'Version activated', activeVersionId: 'v1' });
        }),
      );

      const { result } = renderHook(
        () =>
          useAgentCmsForm({
            mode: 'edit',
            agentId: AGENT_ID,
            dataSource,
            isCodeAgentOverride: true,
            hasStoredOverride: true,
            editorConfig: undefined,
            onSuccess: () => {},
          }),
        { wrapper: makeWrapper() },
      );

      act(() => {
        result.current.form.setValue('instructionBlocks', [createRefInstructionBlock('draft-block')], {
          shouldDirty: true,
        });
      });

      await act(async () => {
        await result.current.handlePublish('v1');
      });

      // Publishing a specific version bypasses the guard: the activation request
      // was sent, no create request happened, and no guard toast fired.
      await waitFor(() => expect(activationRequested).toBe(true));
      expect(sink.body).toBeNull();
      expect(toastError).not.toHaveBeenCalled();
    });
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

describe('useAgentCmsForm', () => {
  // Regression coverage: the version list backs the version dropdown and the
  // published/unpublished badges. Skipping its invalidation for code-agent
  // overrides left Studio showing stale publication state after a save.
  describe('when a code-agent override is saved', () => {
    it('refetches the agent version list once the save completes', async () => {
      const sink: { body: Record<string, unknown> | null } = { body: null };
      captureCreateBody(sink);

      let versionRequests = 0;
      server.use(
        http.get(`${BASE_URL}/api/stored/agents/${AGENT_ID}/versions`, () => {
          versionRequests += 1;
          return HttpResponse.json(versionRequests === 1 ? noAgentVersions : oneUnpublishedAgentVersion);
        }),
      );

      const { result } = renderHook(
        () => ({
          cmsForm: useAgentCmsForm({
            mode: 'edit',
            agentId: AGENT_ID,
            dataSource,
            isCodeAgentOverride: true,
            hasStoredOverride: false,
            onSuccess: () => {},
          }),
          versions: useAgentVersions({ agentId: AGENT_ID, params: { orderBy: { direction: 'DESC' } } }),
        }),
        { wrapper: makeWrapper() },
      );

      await waitFor(() => expect(result.current.versions.data).toEqual(noAgentVersions));

      act(() => {
        result.current.cmsForm.form.setValue('instructionBlocks', [createInstructionBlock('User edited prompt')], {
          shouldDirty: true,
        });
      });

      await act(async () => {
        await result.current.cmsForm.handleSaveDraft();
      });

      // The saved version shows up in the dropdown without a manual reload.
      await waitFor(() => expect(result.current.versions.data).toEqual(oneUnpublishedAgentVersion));
    });
  });

  // The first save for a code-defined agent creates the stored override. Publishing it
  // there would put the override live before the user asked, silently replacing the code
  // definition that was already serving traffic.
  describe('when the first code-agent override is saved', () => {
    it('asks the server not to publish the override so it stays a draft until the user publishes', async () => {
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
      expect(sink.body?.autoPublish).toBe(false);
    });
  });
});
