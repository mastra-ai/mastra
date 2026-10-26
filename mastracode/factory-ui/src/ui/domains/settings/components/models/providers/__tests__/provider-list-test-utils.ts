import { providerDisplayName } from '@mastra/factory/provider-display-name';
import { screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { expect } from 'vitest';

import { server } from '../../../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL } from '../../../../../../../../e2e/ui/render';
import type { OAuthStartResponse, ProviderInfo } from '../../../../../../../api/types';

export const PROVIDERS_URL = `${TEST_BASE_URL}/web/config/providers`;
export const keyUrl = (provider: string) => `${PROVIDERS_URL}/${encodeURIComponent(provider)}/key`;
export const oauthUrl = (provider: string, action: 'start' | 'complete' | 'poll') =>
  `${PROVIDERS_URL}/${encodeURIComponent(provider)}/oauth/${action}`;

export const pasteCodeSession = (sessionId: string): OAuthStartResponse => ({
  sessionId,
  kind: 'paste-code',
  url: 'https://example.com/authorize',
  instructions: 'Authorize and paste the code.',
  expiresAt: Date.now() + 60_000,
});

export function stubProviders(providers: ProviderInfo[], orgKeyAdmin?: boolean) {
  server.use(http.get(PROVIDERS_URL, () => HttpResponse.json({ providers, orgKeyAdmin })));
}

export function rowFor(provider: string, container: HTMLElement = document.body): HTMLElement {
  const row = within(container).getByText(providerDisplayName(provider)).closest('li');
  if (!(row instanceof HTMLElement)) throw new Error(`Provider row not found for ${provider}`);
  return row;
}

export async function openAddProvider(user: UserEvent, container: HTMLElement = document.body) {
  const add = await within(container).findByRole('button', { name: 'Add provider' });
  await waitFor(() => expect(add).toBeEnabled());
  await user.click(add);
  return screen.findByRole('dialog', { name: 'Add provider' });
}

export async function saveKey(user: UserEvent, key: string) {
  await user.type(await screen.findByPlaceholderText('Paste API key'), key);
  await user.click(screen.getByRole('button', { name: 'Save' }));
}

export async function pickRowAction(user: UserEvent, provider: string, action: string) {
  const trigger = within(rowFor(provider)).getByRole('button', { name: `${providerDisplayName(provider)} actions` });
  await waitFor(() => expect(trigger).toBeEnabled());
  await user.click(trigger);
  await user.click(await screen.findByRole('menuitem', { name: action }));
}
