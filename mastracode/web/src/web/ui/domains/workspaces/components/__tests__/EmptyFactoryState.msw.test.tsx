import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../../e2e/web-ui/render';
import { EmptyFactoryState } from '../EmptyFactoryState';

function stubGithubStatus(body: Record<string, unknown>, options?: { neverResolve?: boolean }) {
  server.use(
    http.get(`${TEST_BASE_URL}/web/github/status`, async () => {
      if (options?.neverResolve) {
        await delay('infinite');
      }
      return HttpResponse.json(body);
    }),
  );
}

describe('EmptyFactoryState', () => {
  it('when GitHub is available, primary opens GitHub and secondary opens local', async () => {
    stubGithubStatus({ enabled: true, connected: false, installations: [] });
    const onConnectGithub = vi.fn();
    const onOpenLocal = vi.fn();
    renderWithProviders(<EmptyFactoryState onConnectGithub={onConnectGithub} onOpenLocal={onOpenLocal} />);

    const primary = await screen.findByRole('button', { name: 'Connect GitHub' });
    await userEvent.click(primary);
    expect(onConnectGithub).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: 'Create factory from local folder' }));
    expect(onOpenLocal).toHaveBeenCalledTimes(1);
  });

  it('when GitHub is unavailable, only the local primary is shown', async () => {
    stubGithubStatus({ enabled: false, connected: false, installations: [] });
    const onConnectGithub = vi.fn();
    const onOpenLocal = vi.fn();
    renderWithProviders(<EmptyFactoryState onConnectGithub={onConnectGithub} onOpenLocal={onOpenLocal} />);

    const local = await screen.findByRole('button', { name: 'Create factory from local folder' });
    expect(screen.queryByRole('button', { name: 'Connect GitHub' })).not.toBeInTheDocument();
    await userEvent.click(local);
    expect(onOpenLocal).toHaveBeenCalledTimes(1);
    expect(onConnectGithub).not.toHaveBeenCalled();
  });

  it('while status is pending, does not flash a local-only primary', async () => {
    stubGithubStatus({ enabled: true, connected: false, installations: [] }, { neverResolve: true });
    renderWithProviders(<EmptyFactoryState onConnectGithub={vi.fn()} onOpenLocal={vi.fn()} />);

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Connect GitHub' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Create factory from local folder' })).not.toBeInTheDocument();
    });
  });
});
