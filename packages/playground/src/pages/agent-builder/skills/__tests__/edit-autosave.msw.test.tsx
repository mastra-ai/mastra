import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AgentBuilderSkillsEdit from '../edit';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const SKILL_ID = 'skill-test-123';
vi.mock('@mastra/playground-ui/store/playground-store', () => ({
  usePlaygroundStore: () => ({ requestContext: undefined }),
}));

vi.mock('@mastra/playground-ui/utils/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// The chat composer mounts an SSE-driven builder agent which we don't want to
// boot in the autosave test. Stub it with a minimal shell — the form is the
// surface under test.
vi.mock('@/domains/agents/components/agent-cms-pages/skill-chat-composer', () => ({
  SkillChatComposer: () => <div data-testid="skill-chat-composer-stub" />,
}));

const renderEditPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <MemoryRouter initialEntries={[`/agent-builder/skills/${SKILL_ID}/edit`]}>
            <Routes>
              <Route path="/agent-builder/skills/:id/edit" element={<AgentBuilderSkillsEdit />} />
              <Route path="/agent-builder/skills" element={<div data-testid="skills-list-page" />} />
            </Routes>
          </MemoryRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
};

describe('AgentBuilderSkillsEdit autosave', () => {
  beforeEach(() => {
    server.use(
      // The signed-in user owns the skill (matching authorId), and RBAC is
      // disabled so every permission check passes.
      http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json({ id: 'user-1' })),
      http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json({ enabled: false, login: null })),
      http.get(`${BASE_URL}/api/stored/skills/${SKILL_ID}`, () =>
        HttpResponse.json({
          id: SKILL_ID,
          name: 'initial name',
          description: 'initial description',
          instructions: 'initial instructions',
          visibility: 'private',
          authorId: 'user-1',
          files: [],
        }),
      ),
    );
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  describe('when a single field is edited', () => {
    it('debounces edits and PATCHes /api/stored/skills/:id with the latest form values', async () => {
      const patchCalls: any[] = [];
      server.use(
        http.patch(`${BASE_URL}/api/stored/skills/${SKILL_ID}`, async ({ request }) => {
          patchCalls.push(await request.json());
          return HttpResponse.json({ id: SKILL_ID });
        }),
      );

      const { findByDisplayValue, getByDisplayValue } = renderEditPage();

      // Wait for the form to hydrate from the GET response.
      const nameInput = (await findByDisplayValue('initial name')) as HTMLInputElement;
      getByDisplayValue('initial description');

      // Edit the name. Autosave should debounce ~600ms.
      await act(async () => {
        fireEvent.change(nameInput, { target: { value: 'renamed skill' } });
      });

      await waitFor(() => expect(patchCalls.length).toBeGreaterThanOrEqual(1), { timeout: 3000 });

      const last = patchCalls[patchCalls.length - 1];
      expect(last.name).toBe('renamed skill');
      expect(last.description).toBe('initial description');
      expect(last.instructions).toBe('initial instructions');
      expect(last.visibility).toBe('private');
    });
  });

  describe('when several edits land within the debounce window', () => {
    it('coalesces rapid edits into a single save for the final value', async () => {
      const patchCalls: any[] = [];
      server.use(
        http.patch(`${BASE_URL}/api/stored/skills/${SKILL_ID}`, async ({ request }) => {
          patchCalls.push(await request.json());
          return HttpResponse.json({ id: SKILL_ID });
        }),
      );

      const { findByDisplayValue } = renderEditPage();
      const nameInput = (await findByDisplayValue('initial name')) as HTMLInputElement;

      // Three rapid edits within the debounce window.
      await act(async () => {
        fireEvent.change(nameInput, { target: { value: 'step 1' } });
        fireEvent.change(nameInput, { target: { value: 'step 2' } });
        fireEvent.change(nameInput, { target: { value: 'final' } });
      });

      await waitFor(() => expect(patchCalls.length).toBeGreaterThanOrEqual(1), { timeout: 3000 });

      // Give any stragglers time to arrive, then assert we only saw one save with
      // the final value.
      await new Promise(resolve => setTimeout(resolve, 200));
      expect(patchCalls).toHaveLength(1);
      expect(patchCalls[0].name).toBe('final');
    });
  });
});
