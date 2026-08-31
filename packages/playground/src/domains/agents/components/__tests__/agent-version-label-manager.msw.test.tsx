// @vitest-environment jsdom
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { agentVersionQueryKeys } from '../../hooks/agent-version-query-keys';
import { AgentVersionLabelManager } from '../agent-version-label-manager';
import type { AgentVersionLabelManagerProps } from '../agent-version-label-manager';
import {
  AGENT_VERSION_LABELS_AGENT_ID,
  managerVersionLabelsError,
  mutableManagerVersionLabels,
  mutableVersionLabelPackages,
  mutationVersionHistory,
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
    http.get(`${TEST_BASE_URL}/api/auth/capabilities`, () =>
      HttpResponse.json(versionLabelPublisherCapabilities),
    ),
    http.get(`${TEST_BASE_URL}/api/stored/agents/${AGENT_VERSION_LABELS_AGENT_ID}/labels`, () =>
      HttpResponse.json(mutableManagerVersionLabels),
    ),
  );
};

const renderManager = (permissionProps: PublishPermissionProps = {}) =>
  renderWithProviders(
    <AgentVersionLabelManager
      agentId={AGENT_VERSION_LABELS_AGENT_ID}
      versions={mutationVersionHistory.versions}
      activeVersionId="version-2"
      onRefreshVersions={async () => 'version-2'}
      {...permissionProps}
    />,
  );

const openManager = async () => {
  fireEvent.click(await screen.findByRole('button', { name: 'Manage labels' }));
  return screen.findByRole('dialog', { name: 'Manage version labels' });
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

      expect(
        within(manager).getByText(/Mutation controls stay disabled until access is checked/),
      ).not.toBeNull();
      expect(within(manager).queryByRole('button', { name: 'Create custom label' })).toBeNull();
      expect(within(manager).queryByRole('button', { name: /Production/ })).toBeNull();
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
});
