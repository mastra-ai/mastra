// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { createInstructionBlock } from '../../components/agent-edit-page/utils/form-validation';
import type { AgentDataSource } from '../../utils/compute-agent-initial-values';
import { useAgentCmsForm } from '../use-agent-cms-form';
import { createdCodeAgent } from './fixtures/use-agent-cms-form';
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
