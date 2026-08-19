import type { AgentControllerAvailableModel } from '@mastra/client-js';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../e2e/ui/render';
import type { ModelPackInfo } from '../../../../../api/types';
import { ModelPacksSection } from '../ModelPacksSection';

const PACKS_URL = `${TEST_BASE_URL}/web/config/model-packs`;
const activateUrl = (id: string) => `${PACKS_URL}/${encodeURIComponent(id)}/activate`;
const itemUrl = (id: string) => `${PACKS_URL}/${encodeURIComponent(id)}`;

const models: AgentControllerAvailableModel[] = [
  { id: 'openai/gpt-x', provider: 'openai' } as AgentControllerAvailableModel,
  { id: 'anthropic/claude-x', provider: 'anthropic' } as AgentControllerAvailableModel,
];

function packsResponse(
  packs: ModelPackInfo[],
  activePackId: string | null = null,
  sessionPackId: string | null = null,
) {
  return HttpResponse.json({ packs, activePackId, sessionPackId });
}

/** Open a searchable combobox and pick an option (Base UI selects on pointer events). */
async function pickOption(user: ReturnType<typeof userEvent.setup>, trigger: HTMLElement, name: RegExp) {
  await user.click(trigger);
  const option = await screen.findByRole('option', { name });
  fireEvent.pointerDown(option, { pointerType: 'mouse' });
  fireEvent.click(option, { detail: 1 });
  // Wait for the popup to close so the next interaction targets a settled DOM.
  await waitFor(() => expect(screen.queryByRole('option', { name })).not.toBeInTheDocument());
}

async function rowFor(packName: string): Promise<HTMLLIElement> {
  const row = (await screen.findByText(packName)).closest('li');
  if (!(row instanceof HTMLLIElement)) throw new Error(`Model pack row not found for ${packName}`);
  return row;
}

const builtinPack: ModelPackInfo = {
  id: 'builtin',
  name: 'Builtin Pack',
  description: '',
  models: { build: 'openai/gpt-x', plan: 'openai/gpt-x', fast: 'openai/gpt-x' },
  custom: false,
  active: false,
};

describe('ModelPacksSection', () => {
  describe('while packs are loading', () => {
    it('renders a skeleton placeholder instead of loading text', async () => {
      server.use(
        http.get(PACKS_URL, async () => {
          await delay(150);
          return packsResponse([builtinPack]);
        }),
      );

      renderWithProviders(<ModelPacksSection models={models} />);

      expect(await screen.findByRole('status', { name: 'Loading model packs' })).toBeInTheDocument();
      expect(screen.queryByText(/Loading model packs/)).not.toBeInTheDocument();

      expect(await screen.findByText('Builtin Pack')).toBeInTheDocument();
      expect(screen.queryByRole('status', { name: 'Loading model packs' })).not.toBeInTheDocument();
    });
  });

  describe('when packs load', () => {
    it('renders the available packs', async () => {
      server.use(http.get(PACKS_URL, () => packsResponse([builtinPack])));

      renderWithProviders(<ModelPacksSection models={models} />);

      expect(await screen.findByText('Builtin Pack')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Use in this chat' })).not.toBeInTheDocument();
    });
  });

  describe('when setting the chat default', () => {
    it('selects a default pack for future chats', async () => {
      let activateBody: unknown;
      server.use(
        http.get(PACKS_URL, () => packsResponse([builtinPack])),
        http.post(activateUrl('builtin'), async ({ request }) => {
          activateBody = await request.json();
          return HttpResponse.json({ ok: true, target: 'default', activePackId: 'builtin' });
        }),
      );

      const user = userEvent.setup();
      renderWithProviders(<ModelPacksSection models={models} />);

      const row = await rowFor('Builtin Pack');
      await user.click(within(row).getByRole('button', { name: 'Set default' }));

      await waitFor(() => expect(activateBody).toEqual({ target: 'default' }));
    });
  });

  describe('when a default pack is selected', () => {
    it('updates the personal default without changing the current chat', async () => {
      const packs: ModelPackInfo[] = [builtinPack];
      let activateBody: unknown;
      server.use(
        http.get(PACKS_URL, () => packsResponse(packs, packs.find(p => p.active)?.id ?? null)),
        http.post(activateUrl('builtin'), async ({ request }) => {
          activateBody = await request.json();
          packs[0] = { ...builtinPack, active: true };
          return HttpResponse.json({ ok: true, target: 'default', activePackId: 'builtin' });
        }),
      );

      const user = userEvent.setup();
      renderWithProviders(<ModelPacksSection models={models} />);

      const row = await rowFor('Builtin Pack');
      await user.click(within(row).getByRole('button', { name: 'Set default' }));

      await waitFor(() => expect(activateBody).toEqual({ target: 'default' }));
      await waitFor(() => expect(within(row).getByText('Default')).toBeInTheDocument());
    });

    it('clears the personal default', async () => {
      let active = true;
      server.use(
        http.get(PACKS_URL, () => packsResponse([{ ...builtinPack, active }], active ? 'builtin' : null)),
        http.delete(`${PACKS_URL}/active`, () => {
          active = false;
          return HttpResponse.json({ ok: true, activePackId: null });
        }),
      );

      const user = userEvent.setup();
      renderWithProviders(<ModelPacksSection models={models} />);

      const row = await rowFor('Builtin Pack');
      await user.click(within(row).getByRole('button', { name: 'Clear default' }));

      await waitFor(() => expect(within(row).getByRole('button', { name: 'Set default' })).toBeInTheDocument());
    });
  });

  describe('when a custom pack is created', () => {
    it('POSTs the draft and refetches so the pack appears', async () => {
      const packs: ModelPackInfo[] = [];
      let postBody: unknown;
      server.use(
        http.get(PACKS_URL, () => packsResponse(packs)),
        http.post(PACKS_URL, async ({ request }) => {
          postBody = await request.json();
          packs.push({
            id: 'mine',
            name: 'My Pack',
            description: '',
            models: { build: 'openai/gpt-x', plan: 'anthropic/claude-x', fast: 'openai/gpt-x' },
            custom: true,
            active: false,
          });
          return HttpResponse.json({ ok: true });
        }),
      );

      const user = userEvent.setup();
      renderWithProviders(<ModelPacksSection models={models} />);

      await user.click(await screen.findByRole('button', { name: 'New pack' }));
      await user.type(screen.getByPlaceholderText('e.g. my-pack'), 'My Pack');
      const selects = screen.getAllByRole('combobox');
      await pickOption(user, selects[0]!, /openai\/gpt-x/);
      await pickOption(user, selects[1]!, /anthropic\/claude-x/);
      await pickOption(user, selects[2]!, /openai\/gpt-x/);
      await user.click(screen.getByRole('button', { name: 'Add' }));

      await waitFor(() =>
        expect(postBody).toEqual({
          name: 'My Pack',
          models: { build: 'openai/gpt-x', plan: 'anthropic/claude-x', fast: 'openai/gpt-x' },
        }),
      );
      expect(await screen.findByText('My Pack')).toBeInTheDocument();
    });
  });

  describe('when a custom pack is removed', () => {
    it('DELETEs it and refetches so it drops out', async () => {
      const custom: ModelPackInfo = { ...builtinPack, id: 'mine', name: 'My Pack', custom: true };
      const packs: ModelPackInfo[] = [custom];
      let removed = false;
      server.use(
        http.get(PACKS_URL, () => packsResponse(packs)),
        http.delete(itemUrl('mine'), () => {
          removed = true;
          packs.length = 0;
          return HttpResponse.json({ ok: true });
        }),
      );

      const user = userEvent.setup();
      renderWithProviders(<ModelPacksSection models={models} />);

      const row = await rowFor('My Pack');
      await user.click(within(row).getByRole('button', { name: 'Remove' }));

      await waitFor(() => expect(removed).toBe(true));
      await waitFor(() => expect(screen.queryByText('My Pack')).not.toBeInTheDocument());
    });
  });
});
