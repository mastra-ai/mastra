// @vitest-environment jsdom
import type { ListAgentVersionLabelsResponse, ListAgentVersionsResponse } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { agentVersionQueryKeys } from '../../hooks/agent-version-query-keys';
import { AgentVersionPanel } from '../agent-version-panel';
import {
  AGENT_VERSION_LABELS_AGENT_ID,
  customOnlyOverflowVersionLabels,
  duplicateVersionLabels,
  emptyManagerVersionLabels,
  LABELED_VERSION_ID,
  managerVersionLabels,
  managerVersionLabelsError,
  managerVersionLabelMutationIntegrityError,
  mutableManagerVersionLabels,
  mutableVersionLabelPackages,
  mutationVersionHistory,
  overflowingVersionLabels,
  readableVersionLabelPackages,
  unlabeledVersionHistory,
  unorderedVersionLabels,
  unsupportedVersionLabelPackages,
  versionLabelNonReaderCapabilities,
  versionLabelPublisherCapabilities,
  versionLabelReaderCapabilities,
} from './fixtures/agent-version-labels';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

function registerVersionResponse(response: ListAgentVersionsResponse) {
  server.use(
    http.get(`${BASE_URL}/api/stored/agents/${AGENT_VERSION_LABELS_AGENT_ID}/versions`, () =>
      HttpResponse.json(response),
    ),
    http.get(`${BASE_URL}/api/system/packages`, () => HttpResponse.json(unsupportedVersionLabelPackages)),
    http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json({ enabled: false, login: null })),
  );
}

function registerReadableLabelAccess() {
  server.use(
    http.get(`${BASE_URL}/api/system/packages`, () => HttpResponse.json(readableVersionLabelPackages)),
    http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(versionLabelReaderCapabilities)),
  );
}

function registerReadableLabels(response: ListAgentVersionLabelsResponse = managerVersionLabels) {
  registerReadableLabelAccess();
  server.use(
    http.get(`${BASE_URL}/api/stored/agents/${AGENT_VERSION_LABELS_AGENT_ID}/labels`, () =>
      HttpResponse.json(response),
    ),
  );
}

function createDeferred() {
  let resolve = () => {};
  const promise = new Promise<void>(settle => {
    resolve = settle;
  });
  return { promise, resolve };
}

function renderVersionPanel(
  onVersionSelect = () => {},
  options: {
    activeVersionId?: string;
    selectedVersionId?: string;
    onRetryProductionState?: (options?: { throwOnError?: boolean }) => Promise<void>;
  } = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return {
    ...render(
      <MastraReactProvider baseUrl={BASE_URL}>
        <QueryClientProvider client={queryClient}>
          <AgentVersionPanel
            agentId={AGENT_VERSION_LABELS_AGENT_ID}
            activeVersionId={options.activeVersionId ?? LABELED_VERSION_ID}
            selectedVersionId={options.selectedVersionId}
            onRetryProductionState={options.onRetryProductionState}
            onVersionSelect={onVersionSelect}
          />
        </QueryClientProvider>
      </MastraReactProvider>,
    ),
    queryClient,
  };
}

afterEach(() => cleanup());

describe('AgentVersionPanel', () => {
  describe('when version labels arrive in arbitrary server order', () => {
    it('renders production first, custom labels in ASCII lexical order, and latest last', async () => {
      registerVersionResponse(unorderedVersionLabels);

      renderVersionPanel();

      const labels = await screen.findByRole('list', { name: 'Labels for version v3' });
      const labelNames = within(labels)
        .getAllByRole('listitem', { name: / version label$/ })
        .map(label => label.textContent);
      expect(labelNames).toEqual(['production', 'alpha', 'zeta', 'latest']);
    });

    it('uses the production label instead of the legacy Published badge', async () => {
      registerVersionResponse(unorderedVersionLabels);

      renderVersionPanel();

      expect(await screen.findByText('production')).not.toBeNull();
      expect(screen.queryByText('Published')).toBeNull();
    });

    it('deduplicates labels before applying the canonical order', async () => {
      registerVersionResponse(duplicateVersionLabels);

      renderVersionPanel();

      const labels = await screen.findByRole('list', { name: 'Labels for version v3' });
      const labelNames = within(labels)
        .getAllByRole('listitem', { name: / version label$/ })
        .map(label => label.textContent);
      expect(labelNames).toEqual(['production', 'alpha', 'beta', 'latest']);
      expect(screen.queryByRole('button', { name: /more labels for version v3/i })).toBeNull();
    });

    it('exposes the complete label name to assistive technology and pointer users', async () => {
      registerVersionResponse(unorderedVersionLabels);

      renderVersionPanel();

      const alpha = await screen.findByRole('listitem', { name: 'alpha version label' });
      expect(alpha.getAttribute('title')).toBe('alpha');
      expect(alpha.textContent).toBe('alpha');
    });
  });

  describe('when more labels target a version than fit in the row', () => {
    it('keeps reserved labels visible and discloses the hidden custom labels', async () => {
      registerVersionResponse(overflowingVersionLabels);

      renderVersionPanel();

      const visibleLabels = await screen.findByRole('list', { name: 'Labels for version v3' });
      const visibleLabelNames = within(visibleLabels)
        .getAllByRole('listitem', { name: / version label$/ })
        .map(label => label.textContent);
      expect(visibleLabelNames).toEqual(['production', 'alpha', 'beta', 'latest']);
      expect(visibleLabels.textContent).toBe('productionalphabeta+2latest');

      const overflowTrigger = screen.getByRole('button', { name: 'Show 2 more labels for version v3' });
      fireEvent.click(overflowTrigger);

      const hiddenLabels = await screen.findByRole('list', { name: 'More labels for version v3' });
      const hiddenLabelNames = within(hiddenLabels)
        .getAllByRole('listitem', { name: / version label$/ })
        .map(label => label.textContent);
      expect(hiddenLabelNames).toEqual(['gamma', 'zulu']);
    });

    it('does not select the version when the overflow disclosure is opened', async () => {
      registerVersionResponse(overflowingVersionLabels);
      const onVersionSelect = vi.fn();
      renderVersionPanel(onVersionSelect);

      const overflowTrigger = await screen.findByRole('button', { name: 'Show 2 more labels for version v3' });
      fireEvent.click(overflowTrigger);

      expect(onVersionSelect).not.toHaveBeenCalled();
    });

    it('uses every visible slot for custom labels when no reserved label is present', async () => {
      registerVersionResponse(customOnlyOverflowVersionLabels);

      renderVersionPanel();

      const visibleLabels = await screen.findByRole('list', { name: 'Labels for version v3' });
      const visibleLabelNames = within(visibleLabels)
        .getAllByRole('listitem', { name: / version label$/ })
        .map(label => label.textContent);
      expect(visibleLabelNames).toEqual(['alpha', 'bravo', 'charlie', 'delta']);

      fireEvent.click(screen.getByRole('button', { name: 'Show 1 more labels for version v3' }));
      expect(await screen.findByText('More labels for v3')).not.toBeNull();
      const hiddenLabels = await screen.findByRole('list', { name: 'More labels for version v3' });
      expect(within(hiddenLabels).getByRole('listitem', { name: 'echo version label' })).not.toBeNull();
    });
  });

  describe('when a version has no labels', () => {
    it('omits the empty label list', async () => {
      registerVersionResponse(unlabeledVersionHistory);

      renderVersionPanel();

      expect(await screen.findByRole('button', { name: /^v3/ })).not.toBeNull();
      expect(screen.queryByRole('list', { name: 'Labels for version v3' })).toBeNull();
    });
  });

  describe('when version history is requested', () => {
    it('asks the server for descending version order', async () => {
      const onDirection = vi.fn();
      registerVersionResponse(unorderedVersionLabels);
      server.use(
        http.get(`${BASE_URL}/api/stored/agents/${AGENT_VERSION_LABELS_AGENT_ID}/versions`, ({ request }) => {
          onDirection(new URL(request.url).searchParams.get('orderBy[direction]'));
          return HttpResponse.json(unorderedVersionLabels);
        }),
      );

      renderVersionPanel();

      await screen.findByRole('button', { name: /^v3/ });
      expect(onDirection).toHaveBeenCalledWith('DESC');
    });

    it('renders a readable creation timestamp with date and time fields', async () => {
      const formatDate = vi.spyOn(Date.prototype, 'toLocaleDateString').mockReturnValue('formatted creation time');

      try {
        registerVersionResponse(unorderedVersionLabels);
        renderVersionPanel();

        expect(await screen.findAllByText('formatted creation time')).toHaveLength(2);
        expect(formatDate).toHaveBeenCalledWith(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      } finally {
        formatDate.mockRestore();
      }
    });

    it('shows each saved version change message in its row', async () => {
      registerVersionResponse(unorderedVersionLabels);

      renderVersionPanel();

      expect((await screen.findByRole('button', { name: /^v3/ })).textContent).toContain('Release snapshot 3');
      expect(screen.getByRole('button', { name: /^v2/ }).textContent).toContain('Release snapshot 2');
    });
  });

  describe('when a version row is selected', () => {
    it('marks the newest version as current when no explicit selection is provided', async () => {
      registerVersionResponse(unorderedVersionLabels);

      renderVersionPanel();

      const newestVersion = await screen.findByRole('button', { name: /^v3/ });
      const olderVersion = screen.getByRole('button', { name: /^v2/ });
      expect(newestVersion.getAttribute('aria-current')).toBe('true');
      expect(olderVersion.getAttribute('aria-current')).toBeNull();
    });

    it('marks an explicit older selection as current', async () => {
      registerVersionResponse(unorderedVersionLabels);

      renderVersionPanel(() => {}, { selectedVersionId: 'version-2' });

      const newestVersion = await screen.findByRole('button', { name: /^v3/ });
      const olderVersion = screen.getByRole('button', { name: /^v2/ });
      expect(newestVersion.getAttribute('aria-current')).toBeNull();
      expect(olderVersion.getAttribute('aria-current')).toBe('true');
    });

    it('selects the immutable version ID when its metadata button is pressed', async () => {
      registerVersionResponse(unorderedVersionLabels);
      const onVersionSelect = vi.fn();
      renderVersionPanel(onVersionSelect);

      fireEvent.click(await screen.findByRole('button', { name: /^v2/ }));

      expect(onVersionSelect).toHaveBeenCalledOnce();
      expect(onVersionSelect).toHaveBeenCalledWith('version-2');
    });
  });

  describe('when a saved version is newer than the active version', () => {
    it('marks only the newer row as a draft', async () => {
      registerVersionResponse(unorderedVersionLabels);

      renderVersionPanel(() => {}, { activeVersionId: 'version-2' });

      const newerVersion = await screen.findByRole('button', { name: /^v3/ });
      const activeVersion = screen.getByRole('button', { name: /^v2/ });
      const newerRow = newerVersion.closest('li');
      const activeRow = activeVersion.closest('li');
      expect(newerRow).not.toBeNull();
      expect(activeRow).not.toBeNull();
      if (!newerRow || !activeRow) throw new Error('Expected each version button to belong to a row');
      expect(within(newerRow).getByText('Draft')).not.toBeNull();
      expect(within(activeRow).queryByText('Draft')).toBeNull();
    });

    it('does not infer drafts when the active version is not in the current page', async () => {
      registerVersionResponse(unorderedVersionLabels);

      renderVersionPanel(() => {}, { activeVersionId: 'version-not-loaded' });

      await screen.findByRole('button', { name: /^v3/ });
      expect(screen.queryByText('Draft')).toBeNull();
    });
  });

  describe('when version history is still loading', () => {
    it('shows a loading status before rendering rows', async () => {
      const versionsGate = createDeferred();
      registerVersionResponse(unorderedVersionLabels);
      server.use(
        http.get(`${BASE_URL}/api/system/packages`, () => HttpResponse.json(mutableVersionLabelPackages)),
        http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(versionLabelPublisherCapabilities)),
        http.get(`${BASE_URL}/api/stored/agents/${AGENT_VERSION_LABELS_AGENT_ID}/labels`, () =>
          HttpResponse.json(mutableManagerVersionLabels),
        ),
        http.get(`${BASE_URL}/api/stored/agents/${AGENT_VERSION_LABELS_AGENT_ID}/versions`, async () => {
          await versionsGate.promise;
          return HttpResponse.json(unorderedVersionLabels);
        }),
      );
      renderVersionPanel();

      expect(await screen.findByText('Loading versions...')).not.toBeNull();
      expect(screen.queryByRole('button', { name: /^v3/ })).toBeNull();
      fireEvent.click(await screen.findByRole('button', { name: 'Manage labels' }));
      const manager = await screen.findByRole('dialog', { name: 'Manage version labels' });
      expect(
        within(manager).getByText(
          'Version history is loading. Label and Production changes remain disabled until it completes.',
        ),
      ).not.toBeNull();
      expect(within(manager).getByText('Production state will be shown after version history loads.')).not.toBeNull();
      expect(within(manager).queryByText('No Production version is set.')).toBeNull();
      expect(within(manager).queryByText('Save a version before managing labels or Production.')).toBeNull();
      expect(
        ((await within(manager).findByRole('button', { name: 'Move preview from v1' })) as HTMLButtonElement).disabled,
      ).toBe(true);
      expect(
        (within(manager).getByRole('button', { name: 'Delete preview from v1' }) as HTMLButtonElement).disabled,
      ).toBe(true);

      versionsGate.resolve();
      expect(await screen.findByRole('button', { name: /^v3/ })).not.toBeNull();
      await waitFor(() =>
        expect(
          (within(manager).getByRole('button', { name: 'Move preview from v1' }) as HTMLButtonElement).disabled,
        ).toBe(false),
      );
    });
  });

  describe('when version history fails', () => {
    it('shows an error and lets the reader retry', async () => {
      let shouldFail = true;
      registerVersionResponse(unorderedVersionLabels);
      server.use(
        http.get(`${BASE_URL}/api/stored/agents/${AGENT_VERSION_LABELS_AGENT_ID}/versions`, () =>
          shouldFail
            ? HttpResponse.json({ error: 'unavailable' }, { status: 500 })
            : HttpResponse.json(unorderedVersionLabels),
        ),
      );
      renderVersionPanel();

      const retry = await screen.findByRole('button', { name: 'Retry version history' });
      expect(screen.getByRole('alert').textContent).toContain('Couldn’t load version history.');
      shouldFail = false;
      fireEvent.click(retry);

      expect(await screen.findByRole('button', { name: /^v3/ })).not.toBeNull();
    });

    it('keeps cached versions visible with a stale warning until an explicit retry succeeds', async () => {
      let shouldFail = false;
      registerVersionResponse(unorderedVersionLabels);
      server.use(
        http.get(`${BASE_URL}/api/stored/agents/${AGENT_VERSION_LABELS_AGENT_ID}/versions`, () =>
          shouldFail
            ? HttpResponse.json({ error: 'version history unavailable' }, { status: 503 })
            : HttpResponse.json(unorderedVersionLabels),
        ),
      );
      const { queryClient } = renderVersionPanel();

      expect(await screen.findByRole('button', { name: /^v3/ })).not.toBeNull();
      shouldFail = true;
      await act(async () => {
        await queryClient.invalidateQueries({
          queryKey: agentVersionQueryKeys.versionLists(AGENT_VERSION_LABELS_AGENT_ID),
        });
      });

      expect(
        await screen.findByText('Version history may be out of date. Showing the last verified versions.'),
      ).not.toBeNull();
      expect(screen.getByRole('button', { name: /^v3/ })).not.toBeNull();
      expect(screen.getByRole('button', { name: /^v2/ })).not.toBeNull();

      shouldFail = false;
      fireEvent.click(screen.getByRole('button', { name: 'Retry version history' }));
      await waitFor(() =>
        expect(
          screen.queryByText('Version history may be out of date. Showing the last verified versions.'),
        ).toBeNull(),
      );
      expect(screen.getByRole('button', { name: /^v3/ })).not.toBeNull();
    });

    it('disables cached custom-label and Production controls until history recovers', async () => {
      let shouldFail = false;
      registerVersionResponse(mutationVersionHistory);
      server.use(
        http.get(`${BASE_URL}/api/system/packages`, () => HttpResponse.json(mutableVersionLabelPackages)),
        http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(versionLabelPublisherCapabilities)),
        http.get(`${BASE_URL}/api/stored/agents/${AGENT_VERSION_LABELS_AGENT_ID}/labels`, () =>
          HttpResponse.json(mutableManagerVersionLabels),
        ),
        http.get(`${BASE_URL}/api/stored/agents/${AGENT_VERSION_LABELS_AGENT_ID}/versions`, () =>
          shouldFail
            ? HttpResponse.json({ error: 'version history unavailable' }, { status: 503 })
            : HttpResponse.json(mutationVersionHistory),
        ),
      );
      const { queryClient } = renderVersionPanel(() => {}, { activeVersionId: 'version-2' });

      expect(await screen.findByRole('button', { name: 'Add label here for v3' })).not.toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Manage labels' }));
      const manager = await screen.findByRole('dialog', { name: 'Manage version labels' });
      expect(await within(manager).findByRole('button', { name: 'Create custom label' })).not.toBeNull();
      expect(within(manager).getByRole('button', { name: 'Promote v3 to Production' })).not.toBeNull();

      shouldFail = true;
      await act(async () => {
        await queryClient.invalidateQueries({
          queryKey: agentVersionQueryKeys.versionLists(AGENT_VERSION_LABELS_AGENT_ID),
        });
      });

      expect(
        await within(manager).findByText(
          'Version history could not be verified. Label and Production changes are disabled until it recovers.',
        ),
      ).not.toBeNull();
      for (const actionName of [
        'Create custom label',
        'Move preview from v1',
        'Delete preview from v1',
        'Promote v3 to Production',
        'v2 is Production',
        'Roll Back Production to v1',
      ]) {
        expect(
          (within(manager).getByRole('button', { name: actionName }) as HTMLButtonElement).disabled,
          actionName,
        ).toBe(true);
      }
      expect(screen.queryByRole('button', { name: /Add label here/ })).toBeNull();

      fireEvent.click(within(manager).getByRole('button', { name: 'Close' }));
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Manage version labels' })).toBeNull());
      expect((screen.getByRole('button', { name: 'Manage labels' }) as HTMLButtonElement).disabled).toBe(true);
    });
  });

  describe('when no saved version exists', () => {
    it('renders an explicit empty state', async () => {
      registerVersionResponse({ versions: [], total: 0, page: 1, perPage: 20, hasMore: false });

      renderVersionPanel();

      expect(await screen.findByText('No saved versions yet.')).not.toBeNull();
      expect(screen.queryByRole('list')).toBeNull();
    });
  });

  describe('when custom-label reads are supported for a reader', () => {
    it('opens a read-only manager with label kinds and immutable targets', async () => {
      registerVersionResponse(unorderedVersionLabels);
      registerReadableLabels();
      renderVersionPanel();

      const manageLabels = await screen.findByRole('button', { name: 'Manage labels' });
      fireEvent.click(manageLabels);

      const manager = await screen.findByRole('dialog', { name: 'Manage version labels' });
      expect(
        within(manager).getByText(
          'View label kinds and their immutable agent version targets. This view does not change labels.',
        ),
      ).not.toBeNull();

      const labelList = await within(manager).findByRole('list', { name: 'Agent version labels' });
      const labelItems = within(labelList).getAllByRole('listitem');
      const labelNames = labelItems.map(item =>
        ['production', 'alpha', 'preview', 'latest'].find(name => within(item).queryByText(name)),
      );
      expect(labelNames).toEqual(['production', 'alpha', 'preview', 'latest']);

      expect(within(manager).getAllByText('Production')).toHaveLength(2);
      expect(within(manager).getAllByText('Custom')).toHaveLength(2);
      expect(within(manager).getByText('Latest')).not.toBeNull();
      expect(within(manager).getByText('v1')).not.toBeNull();
      expect(within(manager).getByTitle('1234567890123').textContent).toBe('1234567890123');
      expect(within(manager).getByText('version-…fier')).not.toBeNull();
      expect(within(manager).getByTitle('version-2-with-an-immutable-identifier')).not.toBeNull();
      expect(within(manager).getByText(/Updated Aug 30, 2026/)).not.toBeNull();
      expect(within(manager).getByRole('button', { name: 'Copy version ID for preview at v2' })).not.toBeNull();
      expect(within(manager).queryByRole('button', { name: /add|move|delete/i })).toBeNull();
    });

    it('does not request the complete label list until the manager opens', async () => {
      const onLabels = vi.fn();
      registerVersionResponse(unorderedVersionLabels);
      registerReadableLabelAccess();
      server.use(
        http.get(`${BASE_URL}/api/stored/agents/${AGENT_VERSION_LABELS_AGENT_ID}/labels`, () => {
          onLabels();
          return HttpResponse.json(managerVersionLabels);
        }),
      );
      renderVersionPanel();

      const manageLabels = await screen.findByRole('button', { name: 'Manage labels' });
      expect(onLabels).not.toHaveBeenCalled();

      fireEvent.click(manageLabels);
      await waitFor(() => expect(onLabels).toHaveBeenCalledOnce());
    });

    it('copies the complete immutable version ID', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      const originalClipboard = navigator.clipboard;
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });

      try {
        registerVersionResponse(unorderedVersionLabels);
        registerReadableLabels();
        renderVersionPanel();

        fireEvent.click(await screen.findByRole('button', { name: 'Manage labels' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Copy version ID for preview at v2' }));

        await waitFor(() => expect(writeText).toHaveBeenCalledWith('version-2-with-an-immutable-identifier'));
      } finally {
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: originalClipboard });
      }
    });
  });

  describe('when a stored-agent publisher manages mutable labels', () => {
    it('offers custom-label and Production pointer workflows', async () => {
      registerVersionResponse(mutationVersionHistory);
      server.use(
        http.get(`${BASE_URL}/api/system/packages`, () => HttpResponse.json(mutableVersionLabelPackages)),
        http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(versionLabelPublisherCapabilities)),
        http.get(`${BASE_URL}/api/stored/agents/${AGENT_VERSION_LABELS_AGENT_ID}/labels`, () =>
          HttpResponse.json(mutableManagerVersionLabels),
        ),
      );
      renderVersionPanel(() => {}, { activeVersionId: 'version-2' });

      fireEvent.click(await screen.findByRole('button', { name: 'Manage labels' }));

      const manager = await screen.findByRole('dialog', { name: 'Manage version labels' });
      expect(await within(manager).findByRole('button', { name: 'Create custom label' })).not.toBeNull();
      expect(within(manager).getByRole('button', { name: 'Move preview from v1' })).not.toBeNull();
      expect(within(manager).getByRole('button', { name: 'Delete preview from v1' })).not.toBeNull();
      expect(within(manager).getByRole('button', { name: 'Promote v3 to Production' })).not.toBeNull();
      expect(within(manager).getByRole('button', { name: 'v2 is Production' }).hasAttribute('disabled')).toBe(true);
      expect(within(manager).getByRole('button', { name: 'Roll Back Production to v1' })).not.toBeNull();
    });
  });

  describe('when the read-only label list is still loading', () => {
    it('announces the loading state in the manager', async () => {
      const labelsGate = createDeferred();
      registerVersionResponse(unorderedVersionLabels);
      registerReadableLabelAccess();
      server.use(
        http.get(`${BASE_URL}/api/stored/agents/${AGENT_VERSION_LABELS_AGENT_ID}/labels`, async () => {
          await labelsGate.promise;
          return HttpResponse.json(managerVersionLabels);
        }),
      );
      renderVersionPanel();

      fireEvent.click(await screen.findByRole('button', { name: 'Manage labels' }));

      const loading = await screen.findByText('Loading labels…');
      expect(loading.parentElement?.getAttribute('role')).toBe('status');
      labelsGate.resolve();
    });
  });

  describe('when the read-only label list is empty', () => {
    it('explains that no labels were found', async () => {
      registerVersionResponse(unorderedVersionLabels);
      registerReadableLabels(emptyManagerVersionLabels);
      renderVersionPanel();

      fireEvent.click(await screen.findByRole('button', { name: 'Manage labels' }));

      expect(await screen.findByText('No version labels found.')).not.toBeNull();
    });
  });

  describe('when the read-only label list fails', () => {
    it('lets the reader retry the request', async () => {
      const onLabels = vi.fn();
      registerVersionResponse(unorderedVersionLabels);
      registerReadableLabelAccess();
      server.use(
        http.get(`${BASE_URL}/api/stored/agents/${AGENT_VERSION_LABELS_AGENT_ID}/labels`, () => {
          onLabels();
          return HttpResponse.json(managerVersionLabelsError, { status: 500 });
        }),
      );
      renderVersionPanel();

      fireEvent.click(await screen.findByRole('button', { name: 'Manage labels' }));
      const retry = await screen.findByRole('button', { name: 'Try again' });
      const initialRequestCount = onLabels.mock.calls.length;
      fireEvent.click(retry);

      await waitFor(() => expect(onLabels.mock.calls.length).toBeGreaterThan(initialRequestCount));
    });

    it('keeps cached labels visible and offers an explicit stale-data retry', async () => {
      registerVersionResponse(unorderedVersionLabels);
      server.use(
        http.get(`${BASE_URL}/api/system/packages`, () => HttpResponse.json(mutableVersionLabelPackages)),
        http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(versionLabelPublisherCapabilities)),
        http.get(`${BASE_URL}/api/stored/agents/${AGENT_VERSION_LABELS_AGENT_ID}/labels`, () =>
          HttpResponse.json(mutableManagerVersionLabels),
        ),
      );
      const { queryClient } = renderVersionPanel();

      expect(await screen.findByRole('button', { name: 'Add label here for v3' })).not.toBeNull();
      fireEvent.click(await screen.findByRole('button', { name: 'Manage labels' }));
      const manager = await screen.findByRole('dialog', { name: 'Manage version labels' });
      expect(await within(manager).findAllByText('preview')).not.toHaveLength(0);
      expect(within(manager).getByRole('button', { name: 'Move preview from v1' })).not.toBeNull();

      server.use(
        http.get(`${BASE_URL}/api/stored/agents/${AGENT_VERSION_LABELS_AGENT_ID}/labels`, () =>
          HttpResponse.json(managerVersionLabelsError, { status: 500 }),
        ),
      );
      await act(async () => {
        await queryClient.invalidateQueries({
          queryKey: agentVersionQueryKeys.labelsRoot(AGENT_VERSION_LABELS_AGENT_ID),
        });
      });

      expect(await screen.findByText(/Showing the last saved result/)).not.toBeNull();
      expect(screen.getAllByText('preview')).not.toHaveLength(0);
      for (const actionName of ['Create custom label', 'Move preview from v1', 'Delete preview from v1']) {
        expect((within(manager).getByRole('button', { name: actionName }) as HTMLButtonElement).disabled).toBe(true);
      }
      expect(screen.queryByRole('button', { name: /Add label here/ })).toBeNull();

      server.use(
        http.get(`${BASE_URL}/api/stored/agents/${AGENT_VERSION_LABELS_AGENT_ID}/labels`, () =>
          HttpResponse.json(mutableManagerVersionLabels),
        ),
      );
      fireEvent.click(screen.getByRole('button', { name: 'Retry label refresh' }));
      await waitFor(() => expect(screen.queryByText(/Showing the last saved result/)).toBeNull());
    });

    it('keeps integrity recovery blocked until an initially failed label query also refreshes', async () => {
      let shouldFailLabels = true;
      let labelRequestCount = 0;
      const onRetryProductionState = vi.fn().mockResolvedValue(undefined);
      registerVersionResponse(mutationVersionHistory);
      server.use(
        http.get(`${BASE_URL}/api/system/packages`, () => HttpResponse.json(mutableVersionLabelPackages)),
        http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(versionLabelPublisherCapabilities)),
        http.get(`${BASE_URL}/api/stored/agents/${AGENT_VERSION_LABELS_AGENT_ID}/labels`, () => {
          labelRequestCount += 1;
          return shouldFailLabels
            ? HttpResponse.json(managerVersionLabelsError, { status: 400 })
            : HttpResponse.json(mutableManagerVersionLabels);
        }),
      );
      server.use(
        http.post(
          `${BASE_URL}/api/stored/agents/${AGENT_VERSION_LABELS_AGENT_ID}/versions/version-3/activate`,
          () => HttpResponse.json(managerVersionLabelMutationIntegrityError, { status: 500 }),
        ),
      );
      renderVersionPanel(() => {}, {
        activeVersionId: 'version-2',
        onRetryProductionState,
      });

      await waitFor(() => expect(labelRequestCount).toBeGreaterThan(0));
      const requestsBeforeMutation = labelRequestCount;
      fireEvent.click(await screen.findByRole('button', { name: 'Manage labels' }));
      const manager = await screen.findByRole('dialog', { name: 'Manage version labels' });
      fireEvent.click(within(manager).getByRole('button', { name: 'Promote v3 to Production' }));
      const productionDialog = await screen.findByRole('dialog', { name: 'Promote v3 to Production' });
      fireEvent.click(within(productionDialog).getByRole('button', { name: 'Promote v3 to Production' }));
      const retry = await within(productionDialog).findByRole('button', { name: 'Retry version-label state' });
      await waitFor(() => expect(labelRequestCount).toBeGreaterThan(requestsBeforeMutation));
      const requestsBeforeRetry = labelRequestCount;

      shouldFailLabels = false;
      fireEvent.click(retry);

      await waitFor(() => expect(labelRequestCount).toBeGreaterThan(requestsBeforeRetry));
      await waitFor(() =>
        expect(within(productionDialog).queryByRole('button', { name: 'Retry version-label state' })).toBeNull(),
      );
      expect(onRetryProductionState).toHaveBeenCalledWith({ throwOnError: true });
    });
  });

  describe('when custom-label reads are unsupported', () => {
    it('opens an explanation without requesting labels', async () => {
      const onLabels = vi.fn();
      const onPackages = vi.fn();
      registerVersionResponse(unorderedVersionLabels);
      server.use(
        http.get(`${BASE_URL}/api/system/packages`, () => {
          onPackages();
          return HttpResponse.json(unsupportedVersionLabelPackages);
        }),
        http.get(`${BASE_URL}/api/stored/agents/${AGENT_VERSION_LABELS_AGENT_ID}/labels`, () => {
          onLabels();
          return HttpResponse.json(managerVersionLabels);
        }),
      );
      renderVersionPanel();

      await waitFor(() => expect(onPackages).toHaveBeenCalledOnce());
      fireEvent.click(screen.getByRole('button', { name: 'Manage labels' }));
      expect(await screen.findByText(/Custom labels are not supported by this storage adapter/)).not.toBeNull();
      expect(onLabels).not.toHaveBeenCalled();
    });
  });

  describe('when the user cannot read the stored agent', () => {
    it('keeps the manager hidden without requesting labels', async () => {
      const onLabels = vi.fn();
      const onCapabilities = vi.fn();
      registerVersionResponse(unorderedVersionLabels);
      server.use(
        http.get(`${BASE_URL}/api/system/packages`, () => HttpResponse.json(readableVersionLabelPackages)),
        http.get(`${BASE_URL}/api/auth/capabilities`, () => {
          onCapabilities();
          return HttpResponse.json(versionLabelNonReaderCapabilities);
        }),
        http.get(`${BASE_URL}/api/stored/agents/${AGENT_VERSION_LABELS_AGENT_ID}/labels`, () => {
          onLabels();
          return HttpResponse.json(managerVersionLabels);
        }),
      );
      renderVersionPanel();

      await waitFor(() => expect(onCapabilities).toHaveBeenCalledOnce());
      expect(screen.queryByRole('button', { name: 'Manage labels' })).toBeNull();
      expect(onLabels).not.toHaveBeenCalled();
    });

    it('hides cached label targets if read access is revoked while the manager is open', async () => {
      let canRead = true;
      registerVersionResponse(unorderedVersionLabels);
      server.use(
        http.get(`${BASE_URL}/api/system/packages`, () => HttpResponse.json(readableVersionLabelPackages)),
        http.get(`${BASE_URL}/api/auth/capabilities`, () =>
          HttpResponse.json(canRead ? versionLabelReaderCapabilities : versionLabelNonReaderCapabilities),
        ),
        http.get(`${BASE_URL}/api/stored/agents/${AGENT_VERSION_LABELS_AGENT_ID}/labels`, () =>
          HttpResponse.json(managerVersionLabels),
        ),
      );
      const { queryClient } = renderVersionPanel();

      fireEvent.click(await screen.findByRole('button', { name: 'Manage labels' }));
      const manager = await screen.findByRole('dialog', { name: 'Manage version labels' });
      expect(await within(manager).findByText('preview')).not.toBeNull();

      canRead = false;
      await act(async () => {
        await queryClient.invalidateQueries({ queryKey: agentVersionQueryKeys.authorization });
      });

      expect(await within(manager).findByText(/read access is required/)).not.toBeNull();
      expect(within(manager).getByText('preview').closest('[hidden]')).not.toBeNull();
    });
  });
});
