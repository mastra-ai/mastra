import { formatModelName } from '@mastra/playground-ui/utils/model';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { PathParams } from 'msw';
import { expect } from 'vitest';

import { server } from '../../../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, waitForMutationsIdle } from '../../../../../../../../e2e/ui/render';
import type { DefaultModelResponse } from '../../../../../../../api/types';
import type { AvailableModelOption } from '../../../../../../../hooks/useAvailableModels';
import type { FactoryProjectPayload } from '../../../../../workspaces/services/github';
import { pickModel } from './default-model-test-utils';

export const FACTORY_URL = `${TEST_BASE_URL}/web/factory/projects/fp-1`;
const DEFAULT_MODEL_URL = `${TEST_BASE_URL}/web/config/default-model`;
export const PRIMARY = 'anthropic/claude-opus-5.5';
export const GPT = 'openai/gpt-5.6-sol';
export const GEMINI = 'google/gemini-3.8-flash';
export const GROK = 'xai/grok-5';

const models: AvailableModelOption[] = [
  { id: PRIMARY, provider: 'anthropic', modelName: 'claude-opus-5.5', hasApiKey: true },
  { id: GPT, provider: 'openai', modelName: 'gpt-5.6-sol', hasApiKey: true },
  { id: GEMINI, provider: 'google', modelName: 'gemini-3.8-flash', hasApiKey: true },
  { id: GROK, provider: 'xai', modelName: 'grok-5', hasApiKey: true },
];

export function gate() {
  let open!: () => void;
  const opened = new Promise<void>(resolve => {
    open = resolve;
  });
  return { opened, open };
}

export function stubCatalog() {
  server.use(
    http.get(`${TEST_BASE_URL}/web/config/models`, () => HttpResponse.json({ models, fallbackModelId: null })),
  );
}

export function stubFactory(fallbackModelIds: string[], gates: Promise<void>[] = []) {
  const patchedBodies: unknown[] = [];
  let saved = fallbackModelIds;
  const project = (): FactoryProjectPayload => ({
    id: 'fp-1',
    name: 'Mastra',
    defaultModelId: PRIMARY,
    fallbackModelIds: saved,
  });
  stubCatalog();
  server.use(
    http.get(FACTORY_URL, () => HttpResponse.json({ project: project() })),
    http.patch<PathParams, { fallbackModelIds: string[] }>(FACTORY_URL, async ({ request }) => {
      const body = await request.json();
      patchedBodies.push(body);
      await gates[patchedBodies.length - 1];
      saved = body.fallbackModelIds;
      return HttpResponse.json({ project: project() });
    }),
  );
  return { patchedBodies };
}

export function stubPersonal(defaults: DefaultModelResponse, gates: Promise<void>[] = []) {
  const putBodies: unknown[] = [];
  let saved = defaults;
  stubCatalog();
  server.use(
    http.get(DEFAULT_MODEL_URL, () => HttpResponse.json(saved)),
    http.put<PathParams, { fallbackModelIds: string[] }>(`${DEFAULT_MODEL_URL}/fallbacks`, async ({ request }) => {
      const body = await request.json();
      putBodies.push(body);
      await gates[putBodies.length - 1];
      saved = { ...saved, fallbackModelIds: body.fallbackModelIds };
      return HttpResponse.json({ fallbackModelIds: body.fallbackModelIds });
    }),
  );
  return { putBodies };
}

export async function typeIntoAddFallback(user: UserEvent, text: string) {
  const add = await screen.findByRole('combobox', { name: 'Add fallback' });
  await waitFor(() => expect(add).toBeEnabled());
  await user.click(add);
  await user.type(await screen.findByPlaceholderText('Search models'), text);
  const custom = await screen.findByRole('option', { name: `Use “${text}”` });
  fireEvent.pointerDown(custom, { pointerType: 'mouse' });
  fireEvent.click(custom, { detail: 1 });
}

export function expectFallbackOrder(ids: string[]) {
  expect(screen.getAllByRole('combobox', { name: /^Fallback model/ })).toHaveLength(ids.length);
  ids.forEach((id, index) =>
    expect(screen.getByRole('combobox', { name: `Fallback model ${index + 1}` })).toHaveTextContent(
      formatModelName(id),
    ),
  );
}

export async function editFallbacks(user: UserEvent, client: Parameters<typeof waitForMutationsIdle>[0]) {
  const announcements: string[] = [];
  const announced = async () => {
    await waitForMutationsIdle(client);
    announcements.push(screen.getByRole('status').textContent ?? '');
  };
  await pickModel(user, 'Add fallback', GPT);
  await announced();
  await pickModel(user, 'Add fallback', GEMINI);
  await announced();
  await user.click(await screen.findByRole('button', { name: 'Move fallback 2 up' }));
  await announced();
  await user.click(screen.getByRole('button', { name: 'Remove fallback 1' }));
  await announced();
  return announcements;
}

export const ORDERED_EDITS = [
  { fallbackModelIds: [GPT] },
  { fallbackModelIds: [GPT, GEMINI] },
  { fallbackModelIds: [GEMINI, GPT] },
  { fallbackModelIds: [GPT] },
];
