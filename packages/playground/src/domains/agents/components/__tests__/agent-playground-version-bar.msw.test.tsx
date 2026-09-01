import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AgentPlaygroundVersionBar } from '../agent-playground/agent-playground-version-bar';
import {
  firstVersionControlsPage,
  NEWER_VERSION_ID,
  OLDER_VERSION_ID,
  PAGINATED_OLDER_VERSION_ID,
  PAGINATED_PRODUCTION_VERSION_ID,
  PRODUCTION_VERSION_ID,
  secondVersionControlsPage,
  VERSION_CONTROLS_AGENT_ID,
  versionControlsHistory,
} from './fixtures/agent-version-controls';
import { agentVersionQueryKeys } from '@/domains/agents/hooks/agent-version-query-keys';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

type VersionBarProps = Parameters<typeof AgentPlaygroundVersionBar>[0];

function registerVersions() {
  server.use(
    http.get(`${TEST_BASE_URL}/api/stored/agents/${VERSION_CONTROLS_AGENT_ID}/versions`, () =>
      HttpResponse.json(versionControlsHistory),
    ),
  );
}

function VersionBarHarness(props: VersionBarProps) {
  const { versionSelector, actionBar } = AgentPlaygroundVersionBar(props);
  return (
    <>
      {versionSelector}
      {actionBar}
    </>
  );
}

const createProps = (overrides: Partial<VersionBarProps> = {}): VersionBarProps => ({
  agentId: VERSION_CONTROLS_AGENT_ID,
  activeVersionId: PRODUCTION_VERSION_ID,
  selectedVersionId: NEWER_VERSION_ID,
  onVersionSelect: vi.fn(),
  isDirty: false,
  isSavingDraft: false,
  isPublishing: false,
  hasDraft: true,
  readOnly: false,
  canPublish: true,
  isPublishAccessLoading: false,
  onSaveDraft: vi.fn(async () => {}),
  onPublish: vi.fn(async () => true),
  ...overrides,
});

async function openVersionSelector() {
  const selector = await screen.findByRole('combobox');
  await waitFor(() => expect(selector.hasAttribute('disabled')).toBe(false));
  fireEvent.click(selector);
  return selector;
}

afterEach(() => cleanup());

describe('AgentPlaygroundVersionBar', () => {
  it('uses Production for the active stored-agent version and explains that activation only moves a pointer', async () => {
    registerVersions();
    renderWithProviders(<VersionBarHarness {...createProps()} />);

    await openVersionSelector();

    expect(await screen.findByText('Production')).not.toBeNull();
    expect(screen.queryByText('Published')).toBeNull();

    const action = screen.getByRole('button', { name: 'Promote to Production v3' });
    expect(action.getAttribute('title')).toBe(
      'Moves the production pointer to this immutable version without creating a new version.',
    );
    expect(screen.getByRole('button', { name: 'Copy preview version ID for v3' })).not.toBeNull();
  });

  it('preserves Current and Saved terminology for code-source snapshots', async () => {
    registerVersions();
    renderWithProviders(<VersionBarHarness {...createProps({ isCodeSourceAgent: true })} />);

    await openVersionSelector();

    expect(await screen.findByText('Current')).not.toBeNull();
    expect(screen.getAllByText('Saved')).toHaveLength(2);
    expect(screen.queryByText('Production')).toBeNull();
    expect(screen.queryByText('Published')).toBeNull();
  });

  it('distinguishes rollback to an older version from promotion to a newer version', async () => {
    registerVersions();
    const { rerender } = renderWithProviders(
      <VersionBarHarness
        {...createProps({ selectedVersionId: OLDER_VERSION_ID, isViewingPreviousVersion: true, readOnly: true })}
      />,
    );

    expect(await screen.findByRole('button', { name: 'Roll Back Production v1' })).not.toBeNull();

    rerender(
      <VersionBarHarness
        {...createProps({ selectedVersionId: NEWER_VERSION_ID, isViewingPreviousVersion: true, readOnly: true })}
      />,
    );

    expect(await screen.findByRole('button', { name: 'Promote to Production v3' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Roll Back Production v1' })).toBeNull();
  });

  it('offers an exact older version and recognizes Production when both are outside page one', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/api/stored/agents/${VERSION_CONTROLS_AGENT_ID}/versions`, ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get('page'));
        return HttpResponse.json(page === 0 ? firstVersionControlsPage : secondVersionControlsPage);
      }),
    );
    const onVersionSelect = vi.fn();
    renderWithProviders(
      <VersionBarHarness
        {...createProps({
          activeVersionId: PAGINATED_PRODUCTION_VERSION_ID,
          selectedVersionId: PAGINATED_OLDER_VERSION_ID,
          isViewingPreviousVersion: true,
          readOnly: true,
          onVersionSelect,
        })}
      />,
    );

    expect(await screen.findByRole('button', { name: 'Roll Back Production v4' })).not.toBeNull();
    await openVersionSelector();
    const olderVersion = await screen.findByRole('option', { name: /v4 -/ });
    fireEvent.pointerDown(olderVersion, { pointerType: 'mouse' });
    fireEvent.click(olderVersion, { detail: 1 });

    expect(onVersionSelect).toHaveBeenCalledWith(PAGINATED_OLDER_VERSION_ID);
    expect(screen.getByText('Production')).not.toBeNull();
  });

  it('confirms a rollback with the current target, new target, change message, and pointer-only semantics', async () => {
    registerVersions();
    const onPublish = vi.fn(async () => true);
    renderWithProviders(
      <VersionBarHarness
        {...createProps({
          selectedVersionId: OLDER_VERSION_ID,
          isViewingPreviousVersion: true,
          readOnly: true,
          onPublish,
        })}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Roll Back Production v1' }));

    const confirmation = await screen.findByRole('alertdialog');
    expect(within(confirmation).getByRole('heading', { name: 'Roll Back Production?' })).not.toBeNull();
    expect(within(confirmation).getByText('Current production').nextElementSibling?.textContent).toBe('v2');
    expect(within(confirmation).getByText('Target version').nextElementSibling?.textContent).toBe('v1');
    expect(within(confirmation).getByText('Change message').nextElementSibling?.textContent).toBe('Release snapshot 1');
    expect(
      within(confirmation).getByText(
        'This moves the production pointer to an existing immutable version. It does not create a new version.',
      ),
    ).not.toBeNull();
    expect(onPublish).not.toHaveBeenCalled();

    fireEvent.click(within(confirmation).getByRole('button', { name: 'Roll Back Production v1' }));

    await waitFor(() => expect(onPublish).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  });

  it('keeps the production confirmation open when activation fails', async () => {
    registerVersions();
    const onPublish = vi.fn(async () => false);
    renderWithProviders(
      <VersionBarHarness
        {...createProps({
          selectedVersionId: OLDER_VERSION_ID,
          isViewingPreviousVersion: true,
          readOnly: true,
          onPublish,
        })}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Roll Back Production v1' }));
    const confirmation = await screen.findByRole('alertdialog');
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Roll Back Production v1' }));

    await waitFor(() => expect(onPublish).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('alertdialog')).not.toBeNull();
  });

  it('fails closed if publish access changes while confirmation is open', async () => {
    registerVersions();
    const onActivateProduction = vi.fn(async () => ({ status: 'success' as const }));
    const { rerender } = renderWithProviders(<VersionBarHarness {...createProps({ onActivateProduction })} />);

    const action = await screen.findByRole('button', { name: 'Promote to Production v3' });
    await waitFor(() => expect((action as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(action);
    const confirmation = await screen.findByRole('alertdialog');

    rerender(
      <VersionBarHarness {...createProps({ canPublish: false, isPublishAccessLoading: true, onActivateProduction })} />,
    );

    const confirm = within(confirmation).getByRole('button', {
      name: 'Promote to Production v3',
    }) as HTMLButtonElement;
    await waitFor(() => expect(confirm.disabled).toBe(true));
    fireEvent.click(confirm);
    expect(onActivateProduction).not.toHaveBeenCalled();
  });

  it('fails a cached Production confirmation closed when version history refresh fails', async () => {
    let shouldFail = false;
    server.use(
      http.get(`${TEST_BASE_URL}/api/stored/agents/${VERSION_CONTROLS_AGENT_ID}/versions`, () =>
        shouldFail
          ? HttpResponse.json({ error: 'version history unavailable' }, { status: 503 })
          : HttpResponse.json(versionControlsHistory),
      ),
    );
    const onActivateProduction = vi.fn(async () => ({ status: 'success' as const }));
    const { queryClient } = renderWithProviders(<VersionBarHarness {...createProps({ onActivateProduction })} />);

    const action = await screen.findByRole('button', { name: 'Promote to Production v3' });
    await waitFor(() => expect((action as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(action);
    const confirmation = await screen.findByRole('alertdialog');

    shouldFail = true;
    await act(async () => {
      await queryClient.invalidateQueries({
        queryKey: agentVersionQueryKeys.versionLists(VERSION_CONTROLS_AGENT_ID),
      });
    });

    const confirm = within(confirmation).getByRole('button', {
      name: 'Promote to Production v3',
    }) as HTMLButtonElement;
    await waitFor(() => expect(confirm.disabled).toBe(true));
    fireEvent.click(confirm);
    expect(onActivateProduction).not.toHaveBeenCalled();

    fireEvent.click(within(confirmation).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect((screen.getByRole('button', { name: 'Promote to Production v3' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Promote to Production v3' }).getAttribute('title')).toBe(
      'Version history could not be verified. Retry before moving Production.',
    );
  });

  describe('when the frozen Production target disappears after activation fails', () => {
    it('keeps the confirmation open and blocks resubmission until a current version is selected', async () => {
      let currentHistory = versionControlsHistory;
      server.use(
        http.get(`${TEST_BASE_URL}/api/stored/agents/${VERSION_CONTROLS_AGENT_ID}/versions`, () =>
          HttpResponse.json(currentHistory),
        ),
      );
      const onActivateProduction = vi.fn(async () => ({
        status: 'error' as const,
        code: 'VERSION_NOT_FOUND' as const,
        message: 'The selected version no longer exists.',
      }));
      const { queryClient } = renderWithProviders(<VersionBarHarness {...createProps({ onActivateProduction })} />);

      fireEvent.click(await screen.findByRole('button', { name: 'Promote to Production v3' }));
      const confirmation = await screen.findByRole('alertdialog');
      fireEvent.click(within(confirmation).getByRole('button', { name: 'Promote to Production v3' }));
      await waitFor(() => expect(onActivateProduction).toHaveBeenCalledOnce());
      expect(
        await within(confirmation).findByText(
          'The selected target version is no longer available. Choose a current version and reopen this confirmation.',
        ),
      ).not.toBeNull();
      expect(
        within(confirmation).getByRole<HTMLButtonElement>('button', { name: 'Promote to Production v3' }).disabled,
      ).toBe(true);

      currentHistory = {
        ...versionControlsHistory,
        versions: versionControlsHistory.versions.filter(version => version.id !== NEWER_VERSION_ID),
        total: 2,
      };
      await act(async () => {
        await queryClient.invalidateQueries({
          queryKey: agentVersionQueryKeys.versionLists(VERSION_CONTROLS_AGENT_ID),
        });
      });

      const blockedConfirm = within(confirmation).getByRole<HTMLButtonElement>('button', {
        name: 'Promote to Production v3',
      });
      expect(blockedConfirm.disabled).toBe(true);
      fireEvent.click(blockedConfirm);
      expect(onActivateProduction).toHaveBeenCalledOnce();
    });
  });

  it('submits the target and Production precondition captured when confirmation opens', async () => {
    registerVersions();
    const onActivateProduction = vi.fn(async () => ({ status: 'success' as const }));
    const { rerender } = renderWithProviders(
      <VersionBarHarness
        {...createProps({
          selectedVersionId: OLDER_VERSION_ID,
          isViewingPreviousVersion: true,
          readOnly: true,
          onActivateProduction,
        })}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Roll Back Production v1' }));
    const confirmation = await screen.findByRole('alertdialog');

    rerender(
      <VersionBarHarness
        {...createProps({
          activeVersionId: NEWER_VERSION_ID,
          selectedVersionId: NEWER_VERSION_ID,
          isViewingPreviousVersion: false,
          onActivateProduction,
        })}
      />,
    );

    expect(within(confirmation).getByText('Current production').nextElementSibling?.textContent).toBe('v2');
    expect(within(confirmation).getByText('Target version').nextElementSibling?.textContent).toBe('v1');
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Roll Back Production v1' }));

    await waitFor(() =>
      expect(onActivateProduction).toHaveBeenCalledWith({
        versionId: OLDER_VERSION_ID,
        expectedActiveVersionId: PRODUCTION_VERSION_ID,
      }),
    );
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  });

  it('requires refresh and review before deliberately retrying a Production conflict', async () => {
    registerVersions();
    const onActivateProduction = vi
      .fn()
      .mockResolvedValueOnce({ status: 'conflict', message: 'Production changed.' })
      .mockResolvedValueOnce({ status: 'success' });
    const onRefreshProduction = vi.fn(async () => NEWER_VERSION_ID);
    renderWithProviders(
      <VersionBarHarness
        {...createProps({
          selectedVersionId: OLDER_VERSION_ID,
          isViewingPreviousVersion: true,
          readOnly: true,
          onActivateProduction,
          onRefreshProduction,
        })}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Roll Back Production v1' }));
    const confirmation = await screen.findByRole('alertdialog');
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Roll Back Production v1' }));

    expect(
      await within(confirmation).findByText(
        'Production changed while this dialog was open, but its current target could not be refreshed.',
      ),
    ).not.toBeNull();
    const blockedRetry = within(confirmation).getByRole('button', {
      name: 'Try again: Roll Back Production v1',
    }) as HTMLButtonElement;
    expect(blockedRetry.disabled).toBe(true);
    expect(onActivateProduction).toHaveBeenCalledTimes(1);

    fireEvent.click(
      within(confirmation).getByRole('button', { name: 'Refresh current Production before moving to v1' }),
    );
    await waitFor(() => expect(onRefreshProduction).toHaveBeenCalledTimes(1));
    expect(within(confirmation).getByText('Current production').nextElementSibling?.textContent).toBe('v3');
    expect(
      (within(confirmation).getByRole('button', { name: 'Try again: Roll Back Production v1' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    fireEvent.click(
      within(confirmation).getByRole('button', { name: 'Review current Production before moving to v1' }),
    );
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Try again: Roll Back Production v1' }));

    await waitFor(() => expect(onActivateProduction).toHaveBeenCalledTimes(2));
    expect(onActivateProduction).toHaveBeenLastCalledWith({
      versionId: OLDER_VERSION_ID,
      expectedActiveVersionId: NEWER_VERSION_ID,
    });
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  });

  it('disables activation when the selected version is already production', async () => {
    registerVersions();
    const onPublish = vi.fn(async () => true);
    renderWithProviders(
      <VersionBarHarness
        {...createProps({
          selectedVersionId: PRODUCTION_VERSION_ID,
          isViewingPreviousVersion: true,
          readOnly: true,
          onPublish,
        })}
      />,
    );

    const action = await screen.findByRole('button', { name: 'Promote to Production v2' });
    expect((action as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(action);
    expect(onPublish).not.toHaveBeenCalled();
  });

  it.each([
    { canPublish: false, isPublishAccessLoading: false, state: 'denied' },
    { canPublish: true, isPublishAccessLoading: true, state: 'loading' },
  ])(
    'does not expose production activation while publish access is $state',
    async ({ canPublish, isPublishAccessLoading }) => {
      registerVersions();
      renderWithProviders(<VersionBarHarness {...createProps({ canPublish, isPublishAccessLoading })} />);

      await screen.findByRole('combobox');

      expect(screen.queryByRole('button', { name: /Production/ })).toBeNull();
      expect(screen.getByRole('button', { name: 'Save New Version' })).not.toBeNull();
    },
  );
});
