// @vitest-environment jsdom
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { agentVersionQueryKeys } from '../../hooks/agent-version-query-keys';
import { AgentVersionLabelManager } from '../agent-version-label-manager';
import type { AgentVersionLabelManagerProps } from '../agent-version-label-manager';
import {
  AGENT_VERSION_LABELS_AGENT_ID,
  managerForbiddenMutationError,
  managerVersionLabelMutationIntegrityError,
  managerVersionLabelsError,
  mutableManagerVersionLabels,
  mutableVersionLabelPackages,
  mutationVersionHistory,
  unsupportedVersionLabelPackages,
  versionLabelPublisherCapabilities,
} from './fixtures/agent-version-labels';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

type PublishPermissionProps = Pick<
  AgentVersionLabelManagerProps,
  'canPublish' | 'isPublishPermissionLoading' | 'isPublishPermissionError'
>;

const registerMutablePublisher = () => {
  server.use(
    http.get(`${TEST_BASE_URL}/api/system/packages`, () => HttpResponse.json(mutableVersionLabelPackages)),
    http.get(`${TEST_BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(versionLabelPublisherCapabilities)),
    http.get(`${TEST_BASE_URL}/api/stored/agents/${AGENT_VERSION_LABELS_AGENT_ID}/labels`, () =>
      HttpResponse.json(mutableManagerVersionLabels),
    ),
  );
};

const renderManager = (
  permissionProps: PublishPermissionProps = {},
  managerProps: Partial<AgentVersionLabelManagerProps> = {},
) =>
  renderWithProviders(
    <AgentVersionLabelManager
      agentId={AGENT_VERSION_LABELS_AGENT_ID}
      versions={mutationVersionHistory.versions}
      activeVersionId="version-2"
      onRefreshVersions={async () => 'version-2'}
      {...permissionProps}
      {...managerProps}
    />,
  );

const openManager = async () => {
  fireEvent.click(await screen.findByRole('button', { name: 'Manage labels' }));
  return screen.findByRole('dialog', { name: 'Manage version labels' });
};

const openCreateDialog = async () => {
  const manager = await openManager();
  fireEvent.click(await within(manager).findByRole('button', { name: 'Create custom label' }));
  return screen.findByRole('dialog', { name: 'Create custom label' });
};

describe('AgentVersionLabelManager', () => {
  describe('when the explicit publish permission is undefined for an authorized publisher', () => {
    it('falls back to resource-scoped access and enables both mutation workflows', async () => {
      registerMutablePublisher();
      renderManager({ canPublish: undefined });

      const manager = await openManager();

      expect(
        (await within(manager).findByRole<HTMLButtonElement>('button', { name: 'Create custom label' })).disabled,
      ).toBe(false);
      expect(
        within(manager).getByRole<HTMLButtonElement>('button', { name: 'Promote v3 to Production' }).disabled,
      ).toBe(false);
    });
  });

  describe('when an authorized publisher receives an explicit false publish permission', () => {
    it('keeps custom-label and Production mutation workflows read-only', async () => {
      registerMutablePublisher();
      renderManager({ canPublish: false });

      const manager = await openManager();

      expect(await within(manager).findByText('preview')).not.toBeNull();
      expect(within(manager).queryByRole('button', { name: 'Create custom label' })).toBeNull();
      expect(within(manager).queryByRole('button', { name: 'Move preview from v1' })).toBeNull();
      expect(within(manager).getByText('Publishing access is required to move Production.')).not.toBeNull();
    });
  });

  describe('when an authorized publisher has an explicit pending publish-permission check', () => {
    it('disables custom-label and Production mutation controls', async () => {
      registerMutablePublisher();
      renderManager({ isPublishPermissionLoading: true });

      const manager = await openManager();
      const disabledActions = [
        'Create custom label',
        'Move preview from v1',
        'Delete preview from v1',
        'Promote v3 to Production',
        'Roll Back Production to v1',
      ];

      await within(manager).findByRole('button', { name: 'Create custom label' });
      for (const actionName of disabledActions) {
        expect(within(manager).getByRole<HTMLButtonElement>('button', { name: actionName }).disabled).toBe(true);
      }
    });
  });

  describe('when an authorized publisher has an explicit publish-permission error', () => {
    it('fails closed before rendering any mutation controls', async () => {
      registerMutablePublisher();
      renderManager({ isPublishPermissionError: true });

      const manager = await openManager();

      expect(within(manager).getByText(/Mutation controls stay disabled until access is checked/)).not.toBeNull();
      expect(within(manager).queryByRole('button', { name: 'Create custom label' })).toBeNull();
      expect(within(manager).queryByRole('button', { name: /Production/ })).toBeNull();
    });
  });

  describe('while the complete version history is loading', () => {
    it('reports Production as unknown and disables every mutation target', async () => {
      registerMutablePublisher();
      renderManager({}, { activeVersionId: undefined, isVersionHistoryLoading: true });

      const manager = await openManager();

      expect(
        within(manager).getByText(
          'Version history is loading. Label and Production changes remain disabled until it completes.',
        ),
      ).not.toBeNull();
      expect(within(manager).getByText('Production state will be shown after version history loads.')).not.toBeNull();
      expect(within(manager).queryByText('No Production version is set.')).toBeNull();
      expect(within(manager).queryByText('Save a version before managing labels or Production.')).toBeNull();
      for (const actionName of [
        'Create custom label',
        'Move preview from v1',
        'Delete preview from v1',
        'Promote v3 to Production',
        'Promote v2 to Production',
        'Promote v1 to Production',
      ]) {
        expect(
          ((await within(manager).findByRole('button', { name: actionName })) as HTMLButtonElement).disabled,
          actionName,
        ).toBe(true);
      }
    });
  });

  describe('when a cached label refresh fails for an authorized publisher', () => {
    it('disables custom-label mutations while leaving verified Production mutations enabled', async () => {
      registerMutablePublisher();
      const { queryClient } = renderManager();
      const manager = await openManager();

      expect(
        (await within(manager).findByRole<HTMLButtonElement>('button', { name: 'Move preview from v1' })).disabled,
      ).toBe(false);
      server.use(
        http.get(`${TEST_BASE_URL}/api/stored/agents/${AGENT_VERSION_LABELS_AGENT_ID}/labels`, () =>
          HttpResponse.json(managerVersionLabelsError, { status: 500 }),
        ),
      );

      await act(async () => {
        await queryClient.invalidateQueries({
          queryKey: agentVersionQueryKeys.labelsRoot(AGENT_VERSION_LABELS_AGENT_ID),
        });
      });

      await within(manager).findByText(/Showing the last saved result/);
      expect(within(manager).getByRole<HTMLButtonElement>('button', { name: 'Create custom label' }).disabled).toBe(
        true,
      );
      expect(within(manager).getByRole<HTMLButtonElement>('button', { name: 'Move preview from v1' }).disabled).toBe(
        true,
      );
      expect(within(manager).getByRole<HTMLButtonElement>('button', { name: 'Delete preview from v1' }).disabled).toBe(
        true,
      );
      expect(
        within(manager).getByRole<HTMLButtonElement>('button', { name: 'Promote v3 to Production' }).disabled,
      ).toBe(false);
      expect(
        within(manager).getByRole<HTMLButtonElement>('button', { name: 'Roll Back Production to v1' }).disabled,
      ).toBe(false);
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    });
  });

  describe('when a failed mutation refreshes authorization and revokes access', () => {
    it('keeps the open dialog and typed input mounted while failing every mutation control closed', async () => {
      let authorizationRequests = 0;
      const onMutation = vi.fn();
      registerMutablePublisher();
      server.use(
        http.get(`${TEST_BASE_URL}/api/auth/capabilities`, () => {
          authorizationRequests += 1;
          return HttpResponse.json(
            authorizationRequests === 1
              ? versionLabelPublisherCapabilities
              : {
                  ...versionLabelPublisherCapabilities,
                  access: {
                    ...versionLabelPublisherCapabilities.access,
                    permissions: [],
                  },
                },
          );
        }),
        http.put(`${TEST_BASE_URL}/api/stored/agents/${AGENT_VERSION_LABELS_AGENT_ID}/labels/pr-101`, () => {
          onMutation();
          return HttpResponse.json(
            { error: { code: 'FORBIDDEN', message: 'Publishing access is required.' } },
            { status: 403 },
          );
        }),
      );
      renderManager();
      const dialog = await openCreateDialog();
      const input = within(dialog).getByRole<HTMLInputElement>('textbox', { name: 'Label name' });
      fireEvent.change(input, { target: { value: 'pr-101' } });

      fireEvent.click(within(dialog).getByRole('button', { name: 'Create pr-101 for v3' }));

      await waitFor(() => expect(authorizationRequests).toBeGreaterThan(1));
      expect(await screen.findByRole('dialog', { name: 'Create custom label' })).not.toBeNull();
      expect(input.value).toBe('pr-101');
      expect(within(dialog).getByRole<HTMLButtonElement>('button', { name: 'Create pr-101 for v3' }).disabled).toBe(
        true,
      );
      expect(onMutation).toHaveBeenCalledOnce();
    });

    it('keeps an open Production confirmation mounted with its frozen target while failing submission closed', async () => {
      let authorizationRequests = 0;
      const onMutation = vi.fn();
      registerMutablePublisher();
      server.use(
        http.get(`${TEST_BASE_URL}/api/auth/capabilities`, () => {
          authorizationRequests += 1;
          return HttpResponse.json(
            authorizationRequests === 1
              ? versionLabelPublisherCapabilities
              : {
                  ...versionLabelPublisherCapabilities,
                  access: {
                    ...versionLabelPublisherCapabilities.access,
                    permissions: [`stored-agents:publish:${AGENT_VERSION_LABELS_AGENT_ID}`],
                  },
                },
          );
        }),
        http.post(
          `${TEST_BASE_URL}/api/stored/agents/${AGENT_VERSION_LABELS_AGENT_ID}/versions/version-3/activate`,
          () => {
            onMutation();
            return HttpResponse.json(managerForbiddenMutationError, { status: 403 });
          },
        ),
      );
      renderManager();
      const manager = await openManager();
      fireEvent.click(within(manager).getByRole('button', { name: 'Promote v3 to Production' }));
      const initialDialog = await screen.findByRole('dialog', { name: 'Promote v3 to Production' });

      fireEvent.click(within(initialDialog).getByRole('button', { name: 'Promote v3 to Production' }));

      await waitFor(() => expect(authorizationRequests).toBeGreaterThan(1));
      const preservedDialog = screen.getByRole('dialog', { name: 'Promote v3 to Production' });
      expect(within(preservedDialog).getByText('Release snapshot 3')).not.toBeNull();
      expect(
        within(preservedDialog).getByRole<HTMLButtonElement>('button', { name: 'Promote v3 to Production' }).disabled,
      ).toBe(true);
      for (const actionName of ['Create custom label', 'Move preview from v1', 'Delete preview from v1']) {
        expect(
          within(manager).getByRole<HTMLButtonElement>('button', { name: actionName, hidden: true }).disabled,
          actionName,
        ).toBe(true);
      }
      expect(onMutation).toHaveBeenCalledOnce();
    });
  });

  describe('when a failed mutation refreshes custom-label support to unsupported', () => {
    it('keeps the open dialog and exact input mounted while failing custom mutations closed', async () => {
      let capabilityRequests = 0;
      const onMutation = vi.fn();
      registerMutablePublisher();
      server.use(
        http.get(`${TEST_BASE_URL}/api/system/packages`, () => {
          capabilityRequests += 1;
          return HttpResponse.json(
            capabilityRequests === 1 ? mutableVersionLabelPackages : unsupportedVersionLabelPackages,
          );
        }),
        http.put(`${TEST_BASE_URL}/api/stored/agents/${AGENT_VERSION_LABELS_AGENT_ID}/labels/pr-101`, () => {
          onMutation();
          return HttpResponse.json(
            { error: { code: 'VERSION_LABELS_UNSUPPORTED', message: 'Custom labels are unsupported.' } },
            { status: 501 },
          );
        }),
      );
      renderManager();
      const dialog = await openCreateDialog();
      const input = within(dialog).getByRole<HTMLInputElement>('textbox', { name: 'Label name' });
      fireEvent.change(input, { target: { value: 'pr-101' } });

      fireEvent.click(within(dialog).getByRole('button', { name: 'Create pr-101 for v3' }));

      await waitFor(() => expect(capabilityRequests).toBeGreaterThan(1));
      expect(await screen.findByRole('dialog', { name: 'Create custom label' })).not.toBeNull();
      expect(input.value).toBe('pr-101');
      expect(within(dialog).getByRole<HTMLButtonElement>('button', { name: 'Create pr-101 for v3' }).disabled).toBe(
        true,
      );
      expect(onMutation).toHaveBeenCalledOnce();
    });
  });

  describe('when a mutation reports version-label integrity corruption', () => {
    it('preserves the intent and requires an explicit successful state refresh before retrying', async () => {
      let integrityRejected = false;
      let labelsAreHealthy = false;
      const onMutation = vi.fn();
      registerMutablePublisher();
      server.use(
        http.put(`${TEST_BASE_URL}/api/stored/agents/${AGENT_VERSION_LABELS_AGENT_ID}/labels/pr-101`, () => {
          onMutation();
          integrityRejected = true;
          return HttpResponse.json(managerVersionLabelMutationIntegrityError, { status: 500 });
        }),
        http.get(`${TEST_BASE_URL}/api/stored/agents/${AGENT_VERSION_LABELS_AGENT_ID}/labels`, () =>
          !integrityRejected || labelsAreHealthy
            ? HttpResponse.json(mutableManagerVersionLabels)
            : HttpResponse.json(managerVersionLabelMutationIntegrityError, { status: 500 }),
        ),
      );
      renderManager();
      const dialog = await openCreateDialog();
      const input = within(dialog).getByRole<HTMLInputElement>('textbox', { name: 'Label name' });
      fireEvent.change(input, { target: { value: 'pr-101' } });

      fireEvent.click(within(dialog).getByRole('button', { name: 'Create pr-101 for v3' }));

      expect(await within(dialog).findByText(/integrity could not be verified/i)).not.toBeNull();
      expect(input.value).toBe('pr-101');
      const retryMutation = within(dialog).getByRole<HTMLButtonElement>('button', { name: 'Create pr-101 for v3' });
      expect(retryMutation.disabled).toBe(true);
      fireEvent.click(within(dialog).getByRole('button', { name: 'Retry version-label state' }));
      expect(await within(dialog).findByText(/couldn’t refresh verified version-label state/i)).not.toBeNull();
      expect(retryMutation.disabled).toBe(true);

      labelsAreHealthy = true;
      fireEvent.click(within(dialog).getByRole('button', { name: 'Retry version-label state' }));

      await waitFor(() => expect(retryMutation.disabled).toBe(false));
      expect(input.value).toBe('pr-101');
      expect(onMutation).toHaveBeenCalledOnce();
    });

    it('keeps the latch closed when the explicit version-history refresh fails', async () => {
      let versionsAreHealthy = false;
      const onRefreshVersions = vi.fn<NonNullable<AgentVersionLabelManagerProps['onRefreshVersions']>>(options => {
        if (!versionsAreHealthy && options?.throwOnError) return Promise.reject(new Error('versions unavailable'));
        return Promise.resolve('version-2');
      });
      const onRetryProductionState = vi
        .fn<NonNullable<AgentVersionLabelManagerProps['onRetryProductionState']>>()
        .mockResolvedValue(undefined);
      registerMutablePublisher();
      server.use(
        http.put(`${TEST_BASE_URL}/api/stored/agents/${AGENT_VERSION_LABELS_AGENT_ID}/labels/pr-101`, () =>
          HttpResponse.json(managerVersionLabelMutationIntegrityError, { status: 500 }),
        ),
      );
      renderManager({}, { onRefreshVersions, onRetryProductionState });
      const dialog = await openCreateDialog();
      const input = within(dialog).getByRole<HTMLInputElement>('textbox', { name: 'Label name' });
      fireEvent.change(input, { target: { value: 'pr-101' } });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Create pr-101 for v3' }));

      expect(await within(dialog).findByText(/integrity could not be verified/i)).not.toBeNull();
      const retryMutation = within(dialog).getByRole<HTMLButtonElement>('button', { name: 'Create pr-101 for v3' });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Retry version-label state' }));

      expect(await within(dialog).findByText(/couldn’t refresh verified version-label state/i)).not.toBeNull();
      expect(retryMutation.disabled).toBe(true);
      expect(onRefreshVersions).toHaveBeenLastCalledWith({ throwOnError: true });
      expect(onRetryProductionState).toHaveBeenLastCalledWith({ throwOnError: true });

      versionsAreHealthy = true;
      fireEvent.click(within(dialog).getByRole('button', { name: 'Retry version-label state' }));

      await waitFor(() => expect(retryMutation.disabled).toBe(false));
      expect(input.value).toBe('pr-101');
      expect(onRefreshVersions).toHaveBeenCalledTimes(2);
      expect(onRetryProductionState).toHaveBeenCalledTimes(2);
    });
  });

  describe('when the stored Production pointer could not be loaded', () => {
    it('shows a retryable unknown state instead of claiming that Production is unset', async () => {
      const onRetryProductionState = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
      registerMutablePublisher();
      renderManager(
        {},
        {
          activeVersionId: undefined,
          isProductionStateError: true,
          onRetryProductionState,
        },
      );

      const manager = await openManager();

      expect(within(manager).queryByText('No Production version is set.')).toBeNull();
      expect(within(manager).getByText(/Production state could not be verified/)).not.toBeNull();
      const retry = within(manager).getByRole('button', { name: 'Retry Production state' });
      fireEvent.click(retry);
      await waitFor(() => expect(onRetryProductionState).toHaveBeenCalledOnce());
      expect(onRetryProductionState).toHaveBeenLastCalledWith({ throwOnError: true });
      expect(
        within(manager).getByRole<HTMLButtonElement>('button', { name: 'Promote v3 to Production' }).disabled,
      ).toBe(true);
    });
  });

  describe('when retrying an unknown Production pointer fails again', () => {
    it('keeps the unknown-state warning visible without rejecting from the click handler', async () => {
      const onRetryProductionState = vi.fn<() => Promise<void>>().mockRejectedValue(new Error('still unavailable'));
      registerMutablePublisher();
      renderManager(
        {},
        {
          activeVersionId: undefined,
          isProductionStateError: true,
          onRetryProductionState,
        },
      );
      const manager = await openManager();

      fireEvent.click(within(manager).getByRole('button', { name: 'Retry Production state' }));

      await waitFor(() => expect(onRetryProductionState).toHaveBeenCalledOnce());
      expect(within(manager).getByText(/Production state could not be verified/)).not.toBeNull();
      expect(within(manager).queryByText('No Production version is set.')).toBeNull();
    });
  });
});
