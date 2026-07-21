import type { AgentControllerAvailableModel } from '@mastra/client-js';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../../e2e/web-ui/render';
import type { ModelPackInfo } from '../../../../../../shared/api/types';
import { ModelPacksSection } from '../ModelPacksSection';

const PACKS_URL = `${TEST_BASE_URL}/web/config/model-packs`;
const activateUrl = (id: string) => `${PACKS_URL}/${encodeURIComponent(id)}/activate`;
const itemUrl = (id: string) => `${PACKS_URL}/${encodeURIComponent(id)}`;

const RESOURCE_ID = 'res-1';

const models: AgentControllerAvailableModel[] = [
  { id: 'openai/gpt-x', provider: 'openai' } as AgentControllerAvailableModel,
  { id: 'anthropic/claude-x', provider: 'anthropic' } as AgentControllerAvailableModel,
];

function packsResponse(packs: ModelPackInfo[], activePackId: string | null = null) {
  return HttpResponse.json({ packs, activePackId });
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

      renderWithProviders(<ModelPacksSection resourceId={RESOURCE_ID} models={models} />);

      expect(await screen.findByRole('status', { name: 'Loading model packs' })).toBeInTheDocument();
      expect(screen.queryByText(/Loading model packs/)).not.toBeInTheDocument();

      expect(await screen.findByText('Builtin Pack')).toBeInTheDocument();
      expect(screen.queryByRole('status', { name: 'Loading model packs' })).not.toBeInTheDocument();
    });
  });

  describe('when packs load', () => {
    it('renders the available packs', async () => {
      server.use(http.get(PACKS_URL, () => packsResponse([builtinPack])));

      renderWithProviders(<ModelPacksSection resourceId={RESOURCE_ID} models={models} />);

      expect(await screen.findByText('Builtin Pack')).toBeInTheDocument();
    });
  });

  describe('when there is no resourceId', () => {
    it('still lists the catalog but disables Activate and shows the open-project hint', async () => {
      let queryString: string | null = null;
      server.use(
        http.get(PACKS_URL, ({ request }) => {
          queryString = new URL(request.url).search;
          return packsResponse([builtinPack]);
        }),
      );

      renderWithProviders(<ModelPacksSection models={models} />);

      expect(await screen.findByText('Builtin Pack')).toBeInTheDocument();
      expect(screen.getByText(/Open a factory to activate/)).toBeInTheDocument();
      // No resourceId means the request is unscoped.
      expect(queryString).toBe('');

      const row = await rowFor('Builtin Pack');
      expect(within(row).getByRole('button', { name: 'Activate' })).toBeDisabled();
    });
  });

  describe('when a pack is activated', () => {
    it('POSTs the resourceId and refetches so the pack shows active', async () => {
      const packs: ModelPackInfo[] = [builtinPack];
      let activateBody: unknown;
      server.use(
        http.get(PACKS_URL, () => packsResponse(packs, packs.find(p => p.active)?.id ?? null)),
        http.post(activateUrl('builtin'), async ({ request }) => {
          activateBody = await request.json();
          packs[0] = { ...builtinPack, active: true };
          return HttpResponse.json({ ok: true, activePackId: 'builtin' });
        }),
      );

      const user = userEvent.setup();
      renderWithProviders(<ModelPacksSection resourceId={RESOURCE_ID} models={models} />);

      const row = await rowFor('Builtin Pack');
      await user.click(within(row).getByRole('button', { name: 'Activate' }));

      await waitFor(() => expect(activateBody).toEqual({ resourceId: RESOURCE_ID }));
      await waitFor(() => expect(within(row).getByText('Active')).toBeInTheDocument());
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
      renderWithProviders(<ModelPacksSection resourceId={RESOURCE_ID} models={models} />);

      await user.click(await screen.findByRole('button', { name: 'New pack' }));
      await user.type(screen.getByPlaceholderText('e.g. my-pack'), 'My Pack');
      const selects = screen.getAllByRole('combobox');
      await user.selectOptions(selects[0]!, 'openai/gpt-x');
      await user.selectOptions(selects[1]!, 'anthropic/claude-x');
      await user.selectOptions(selects[2]!, 'openai/gpt-x');
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
      renderWithProviders(<ModelPacksSection resourceId={RESOURCE_ID} models={models} />);

      const row = await rowFor('My Pack');
      await user.click(within(row).getByRole('button', { name: 'Remove' }));

      await waitFor(() => expect(removed).toBe(true));
      await waitFor(() => expect(screen.queryByText('My Pack')).not.toBeInTheDocument());
    });
  });
});
