import type { AgentControllerAvailableModel } from '@mastra/client-js';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../e2e/web-ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../e2e/web-ui/render';
import type { ModelPackInfo } from '../../shared/api/types';
import { ModelPacksSection } from './ModelPacksSection';

const PACKS_URL = `${TEST_BASE_URL}/api/web/config/model-packs`;
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

const builtinPack: ModelPackInfo = {
  id: 'builtin',
  name: 'Builtin Pack',
  description: '',
  models: { build: 'openai/gpt-x', plan: 'openai/gpt-x', fast: 'openai/gpt-x' },
  custom: false,
  active: false,
};

describe('ModelPacksSection', () => {
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
      expect(screen.getByText(/Open a project to activate/)).toBeInTheDocument();
      // No resourceId means the request is unscoped.
      expect(queryString).toBe('');

      const row = screen.getByText('Builtin Pack').closest('.provider-row') as HTMLElement;
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

      const row = (await screen.findByText('Builtin Pack')).closest('.provider-row') as HTMLElement;
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

  describe('when a custom pack is edited', () => {
    it('pre-fills the form and POSTs the update on Save', async () => {
      const custom: ModelPackInfo = {
        ...builtinPack,
        id: 'custom:my-pack',
        name: 'my-pack',
        custom: true,
        models: { build: 'openai/gpt-x', plan: 'openai/gpt-x', fast: 'openai/gpt-x' },
      };
      const packs: ModelPackInfo[] = [custom];
      let postBody: unknown;
      server.use(
        http.get(PACKS_URL, () => packsResponse(packs)),
        http.post(PACKS_URL, async ({ request }) => {
          postBody = await request.json();
          packs[0] = {
            ...custom,
            models: { build: 'openai/gpt-x', plan: 'anthropic/claude-x', fast: 'openai/gpt-x' },
          };
          return HttpResponse.json({ ok: true });
        }),
      );

      const user = userEvent.setup();
      renderWithProviders(<ModelPacksSection resourceId={RESOURCE_ID} models={models} />);

      const row = (await screen.findByText('my-pack')).closest('.provider-row') as HTMLElement;
      await user.click(within(row).getByRole('button', { name: 'Edit' }));

      // The form should be pre-filled with existing values.
      expect(screen.getByPlaceholderText('e.g. my-pack')).toHaveValue('my-pack');
      expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();

      // Change the plan model.
      const selects = screen.getAllByRole('combobox');
      await user.selectOptions(selects[1]!, 'anthropic/claude-x');
      await user.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() =>
        expect(postBody).toEqual({
          name: 'my-pack',
          models: { build: 'openai/gpt-x', plan: 'anthropic/claude-x', fast: 'openai/gpt-x' },
        }),
      );
    });

    it('removes the old pack when the name is changed', async () => {
      const custom: ModelPackInfo = {
        ...builtinPack,
        id: 'custom:old-name',
        name: 'old-name',
        custom: true,
      };
      const packs: ModelPackInfo[] = [custom];
      let deleteId: string | null = null;
      let postBody: unknown;
      server.use(
        http.get(PACKS_URL, () => packsResponse(packs)),
        http.delete(`${PACKS_URL}/:id`, ({ params }) => {
          deleteId = decodeURIComponent(params.id as string);
          return HttpResponse.json({ ok: true });
        }),
        http.post(PACKS_URL, async ({ request }) => {
          postBody = await request.json();
          packs[0] = { ...custom, id: 'custom:new-name', name: 'new-name' };
          return HttpResponse.json({ ok: true });
        }),
      );

      const user = userEvent.setup();
      renderWithProviders(<ModelPacksSection resourceId={RESOURCE_ID} models={models} />);

      const row = (await screen.findByText('old-name')).closest('.provider-row') as HTMLElement;
      await user.click(within(row).getByRole('button', { name: 'Edit' }));

      const nameInput = screen.getByPlaceholderText('e.g. my-pack');
      await user.clear(nameInput);
      await user.type(nameInput, 'new-name');
      await user.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => expect(deleteId).toBe('custom:old-name'));
      await waitFor(() => expect((postBody as Record<string, unknown>).name).toBe('new-name'));
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

      const row = (await screen.findByText('My Pack')).closest('.provider-row') as HTMLElement;
      await user.click(within(row).getByRole('button', { name: 'Remove' }));

      await waitFor(() => expect(removed).toBe(true));
      await waitFor(() => expect(screen.queryByText('My Pack')).not.toBeInTheDocument());
    });
  });
});
