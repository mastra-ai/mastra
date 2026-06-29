import type { AgentEditorConfig } from '@mastra/core/agent';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createInstructionBlock } from '../../components/agent-edit-page/utils/form-validation';
import type { AgentDataSource } from '../../utils/compute-agent-initial-values';
import { useAgentCmsForm } from '../use-agent-cms-form';
import { useAgentVersions } from '../use-agent-versions';
import { createdCodeAgent, emptyAgentVersions, savedCodeAgentVersions } from './fixtures/use-agent-cms-form';
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

/** Capture the body of the update (PATCH) request the save flow sends. */
const captureUpdateBody = (sink: { body: Record<string, unknown> | null }) =>
  server.use(
    http.patch(`${BASE_URL}/api/stored/agents/${AGENT_ID}`, async ({ request }) => {
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

  it('refreshes versions after saving a filesystem-backed code agent', async () => {
    const sink: { body: Record<string, unknown> | null } = { body: null };
    let versionRequests = 0;
    captureCreateBody(sink);
    server.use(
      http.get(`${BASE_URL}/api/stored/agents/${AGENT_ID}/versions`, () => {
        versionRequests += 1;
        return HttpResponse.json(versionRequests > 1 ? savedCodeAgentVersions : emptyAgentVersions);
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
          editorConfig: undefined,
          saveSuccessMessage: 'Saved to filesystem',
          onSuccess: () => {},
        }),
        versions: useAgentVersions({ agentId: AGENT_ID }),
      }),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(result.current.versions.data?.total).toBe(0));

    act(() => {
      result.current.cmsForm.form.setValue('instructionBlocks', [createInstructionBlock('User edited prompt')], {
        shouldDirty: true,
      });
    });

    await act(async () => {
      await result.current.cmsForm.handleSaveDraft();
    });

    await waitFor(() => expect(result.current.versions.data?.total).toBe(1));
    expect(versionRequests).toBeGreaterThanOrEqual(2);
  });
});

// The version editor splits "Save" (snapshot a draft) from "Publish" (activate).
// A draft save must tell the server NOT to auto-publish — otherwise the save goes
// live instantly and the explicit Publish action becomes meaningless. The opt-out
// rides on the wire as `publishOnSave: false`.
describe('useAgentCmsForm — draft save does not auto-publish', () => {
  it('sends publishOnSave:false on the first save (create override) and never activates a version', async () => {
    const sink: { body: Record<string, unknown> | null } = { body: null };
    captureCreateBody(sink);

    const onActivate = vi.fn<() => void>();
    server.use(
      http.post(`${BASE_URL}/api/stored/agents/${AGENT_ID}/versions/:versionId/activate`, () => {
        onActivate();
        return HttpResponse.json({ success: true, message: 'activated', activeVersionId: 'v1' });
      }),
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
      result.current.form.setValue('instructionBlocks', [createInstructionBlock('User edited prompt')], {
        shouldDirty: true,
      });
    });

    await act(async () => {
      await result.current.handleSaveDraft();
    });

    await waitFor(() => expect(sink.body).not.toBeNull());

    expect(sink.body!.publishOnSave).toBe(false);
    expect(onActivate).not.toHaveBeenCalled();
  });

  it('sends publishOnSave:false on a subsequent save (update of an existing override)', async () => {
    const sink: { body: Record<string, unknown> | null } = { body: null };
    captureUpdateBody(sink);

    const { result } = renderHook(
      () =>
        useAgentCmsForm({
          mode: 'edit',
          agentId: AGENT_ID,
          dataSource,
          isCodeAgentOverride: true,
          // An override already exists → the save path is an UPDATE, not a create.
          hasStoredOverride: true,
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

    expect(sink.body!.publishOnSave).toBe(false);
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
