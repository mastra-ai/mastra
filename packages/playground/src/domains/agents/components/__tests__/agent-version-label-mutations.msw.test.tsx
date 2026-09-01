// @vitest-environment jsdom
import type {
  AgentVersionLabel,
  ListAgentVersionLabelsResponse,
  ListAgentVersionsResponse,
  VersionLabelApiError,
} from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { AgentVersionPanel } from '../agent-version-panel';
import {
  activatedVersionThree,
  AGENT_VERSION_LABELS_AGENT_ID,
  createdPrLabel,
  deletedPreviewLabel,
  emptyManagerVersionLabels,
  firstMutationVersionPage,
  managerAgentMissingError,
  movedPreviewVersionLabels,
  mutableManagerVersionLabels,
  mutableVersionLabelPackages,
  mutationVersionHistory,
  recreatedPreviewVersionLabels,
  concurrentSecondMutationVersionPage,
  secondMutationVersionPage,
  sourceProviderVersionLabelPackages,
  unsupportedVersionLabelPackages,
  versionLabelPublisherCapabilities,
  versionLabelReaderCapabilities,
} from './fixtures/agent-version-labels';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

beforeAll(() => {
  if (typeof window.PointerEvent === 'undefined') {
    Object.defineProperty(window, 'PointerEvent', { configurable: true, value: window.MouseEvent });
  }
});

const labelMoveConflict: VersionLabelApiError = {
  error: {
    code: 'LABEL_MOVE_CONFLICT',
    message: 'The label changed after it was read.',
    details: {
      currentVersionId: 'version-3',
      currentRevisionToken: 'preview-recreated-revision',
    },
  },
};

const productionMoveConflict: VersionLabelApiError = {
  error: {
    code: 'LABEL_MOVE_CONFLICT',
    message: 'Production changed after it was read.',
    details: { currentActiveVersionId: 'version-1' },
  },
};

const forbiddenMutation: VersionLabelApiError = {
  error: { code: 'FORBIDDEN', message: 'Publishing access is required.' },
};

const unsupportedMutation: VersionLabelApiError = {
  error: { code: 'VERSION_LABELS_UNSUPPORTED', message: 'Custom labels are unsupported.' },
};

const versionNotFoundMutation: VersionLabelApiError = {
  error: { code: 'VERSION_NOT_FOUND', message: 'The selected version no longer exists.' },
};

const invalidLabelMutation: VersionLabelApiError = {
  error: { code: 'INVALID_LABEL', message: 'The label failed server-side validation.' },
};

function registerManagerApi({
  labels = mutableManagerVersionLabels,
  versions = mutationVersionHistory,
}: {
  labels?: ListAgentVersionLabelsResponse;
  versions?: ListAgentVersionsResponse;
} = {}) {
  server.use(
    http.get(`${BASE_URL}/api/system/packages`, () => HttpResponse.json(mutableVersionLabelPackages)),
    http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(versionLabelPublisherCapabilities)),
    http.get(`${BASE_URL}/api/stored/agents/${AGENT_VERSION_LABELS_AGENT_ID}/versions`, () =>
      HttpResponse.json(versions),
    ),
    http.get(`${BASE_URL}/api/stored/agents/${AGENT_VERSION_LABELS_AGENT_ID}/labels`, () => HttpResponse.json(labels)),
  );
}

function renderPanel(options: { activeVersionId?: string; isSourceProviderBacked?: boolean } = {}) {
  const activeVersionId = Object.hasOwn(options, 'activeVersionId') ? options.activeVersionId : 'version-2';
  const isSourceProviderBacked = options.isSourceProviderBacked ?? false;
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <AgentVersionPanel
          agentId={AGENT_VERSION_LABELS_AGENT_ID}
          activeVersionId={activeVersionId}
          isSourceProviderBacked={isSourceProviderBacked}
          onVersionSelect={() => {}}
        />
      </QueryClientProvider>
    </MastraReactProvider>,
  );
}

async function openManager() {
  fireEvent.click(await screen.findByRole('button', { name: 'Manage labels' }));
  return screen.findByRole('dialog', { name: 'Manage version labels' });
}

async function openCreateDialog() {
  const manager = await openManager();
  fireEvent.click(await within(manager).findByRole('button', { name: 'Create custom label' }));
  return screen.findByRole('dialog', { name: 'Create custom label' });
}

async function chooseTarget(dialog: HTMLElement, versionNumber: number) {
  const trigger = within(dialog).getByRole('combobox', { name: 'Target version' });
  fireEvent.click(trigger);
  const option = await screen.findByRole('option', { name: new RegExp(`v${versionNumber} ·`) });
  fireEvent.pointerDown(option, { pointerType: 'mouse' });
  fireEvent.click(option, { detail: 1 });
  await waitFor(() => expect(trigger.textContent).toContain(`v${versionNumber}`));
}

afterEach(() => cleanup());

describe('agent version-label mutation manager', () => {
  describe('when a publisher creates a valid custom label', () => {
    it('uses the exact typed name and the null create precondition', async () => {
      let requestBody: unknown;
      let currentLabels = mutableManagerVersionLabels;
      registerManagerApi();
      server.use(
        http.put(
          `${BASE_URL}/api/stored/agents/${AGENT_VERSION_LABELS_AGENT_ID}/labels/pr-101`,
          async ({ request }) => {
            requestBody = await request.json();
            currentLabels = {
              ...mutableManagerVersionLabels,
              labels: [...mutableManagerVersionLabels.labels, createdPrLabel],
            };
            return HttpResponse.json(createdPrLabel);
          },
        ),
        http.get(`${BASE_URL}/api/stored/agents/${AGENT_VERSION_LABELS_AGENT_ID}/labels`, () =>
          HttpResponse.json(currentLabels),
        ),
      );
      renderPanel();

      const dialog = await openCreateDialog();
      const nameInput = within(dialog).getByRole('textbox', { name: 'Label name' });
      fireEvent.change(nameInput, { target: { value: 'pr-101' } });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Create pr-101 for v3' }));

      await waitFor(() => expect(requestBody).toEqual({ versionId: 'version-3', expectedRevisionToken: null }));
      expect(await screen.findByText('pr-101 now points to v3.')).not.toBeNull();
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Create custom label' })).toBeNull());
      expect(document.activeElement?.textContent).toBe('Create custom label');
    });

    it('creates from a version row with that immutable target and the null precondition', async () => {
      let requestBody: unknown;
      registerManagerApi();
      server.use(
        http.put(
          `${BASE_URL}/api/stored/agents/${AGENT_VERSION_LABELS_AGENT_ID}/labels/row-label`,
          async ({ request }) => {
            requestBody = await request.json();
            return HttpResponse.json({
              ...createdPrLabel,
              name: 'row-label',
              versionId: 'version-1',
              versionNumber: 1,
            });
          },
        ),
      );
      renderPanel();

      fireEvent.click(await screen.findByRole('button', { name: 'Add label here for v1' }));
      const dialog = await screen.findByRole('dialog', { name: 'Create custom label' });
      fireEvent.change(within(dialog).getByRole('textbox', { name: 'Label name' }), {
        target: { value: 'row-label' },
      });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Create row-label for v1' }));

      await waitFor(() => expect(requestBody).toEqual({ versionId: 'version-1', expectedRevisionToken: null }));
    });

    it('announces pending progress while the request is in flight', async () => {
      let resolveRequest = () => {};
      const requestGate = new Promise<void>(resolve => {
        resolveRequest = resolve;
      });
      registerManagerApi();
      server.use(
        http.put(`${BASE_URL}/api/stored/agents/${AGENT_VERSION_LABELS_AGENT_ID}/labels/pending-label`, async () => {
          await requestGate;
          return HttpResponse.json({ ...createdPrLabel, name: 'pending-label' });
        }),
      );
      renderPanel();
      const dialog = await openCreateDialog();
      fireEvent.change(within(dialog).getByRole('textbox', { name: 'Label name' }), {
        target: { value: 'pending-label' },
      });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Create pending-label for v3' }));

      await waitFor(() => expect(dialog.getAttribute('aria-busy')).toBe('true'));
      expect(
        within(dialog).getByRole('button', { name: 'Creating pending-label for v3' }).hasAttribute('disabled'),
      ).toBe(true);
      resolveRequest();
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Create custom label' })).toBeNull());
    });
  });

  describe.each([
    ['invalid grammar', ' Preview ', /Use 1–64 lowercase ASCII/],
    ['a reserved name with alternate casing', 'Production', /reserved labels/],
    ['a duplicate name', 'preview', /already exists/],
  ])('when the operator enters %s', (_condition, value, expectedMessage) => {
    it('preserves the input and blocks the request', async () => {
      const onPut = vi.fn();
      registerManagerApi();
      server.use(
        http.put(`${BASE_URL}/api/stored/agents/${AGENT_VERSION_LABELS_AGENT_ID}/labels/:label`, () => {
          onPut();
          return HttpResponse.json(createdPrLabel);
        }),
      );
      renderPanel();

      const dialog = await openCreateDialog();
      const nameInput = within(dialog).getByRole('textbox', { name: 'Label name' });
      fireEvent.change(nameInput, { target: { value } });
      fireEvent.click(within(dialog).getByRole('button', { name: /^Create .* for v3$/ }));

      expect(await within(dialog).findByText(expectedMessage)).not.toBeNull();
      expect(nameInput.getAttribute('value')).toBe(value);
      expect(onPut).not.toHaveBeenCalled();
    });
  });

  describe('when the backend rejects the label without rejecting its target version', () => {
    it('preserves the intent and allows a retry against the same immutable target', async () => {
      const onPut = vi.fn();
      registerManagerApi();
      server.use(
        http.put(`${BASE_URL}/api/stored/agents/${AGENT_VERSION_LABELS_AGENT_ID}/labels/release-candidate`, () => {
          onPut();
          return HttpResponse.json(invalidLabelMutation, { status: 400 });
        }),
      );
      renderPanel();

      const dialog = await openCreateDialog();
      const nameInput = within(dialog).getByRole<HTMLInputElement>('textbox', { name: 'Label name' });
      fireEvent.change(nameInput, { target: { value: 'release-candidate' } });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Create release-candidate for v3' }));

      expect(await within(dialog).findByText('The label failed server-side validation.')).not.toBeNull();
      expect(nameInput.value).toBe('release-candidate');
      const retry = within(dialog).getByRole<HTMLButtonElement>('button', {
        name: 'Create release-candidate for v3',
      });
      expect(retry.disabled).toBe(false);
      fireEvent.click(retry);
      await waitFor(() => expect(onPut).toHaveBeenCalledTimes(2));
    });
  });

  describe('when another publisher creates the same name first', () => {
    it('keeps the exact intent open and shows the concurrently created target', async () => {
      const onPut = vi.fn();
      const concurrentLabel: AgentVersionLabel = {
        ...createdPrLabel,
        versionId: 'version-1',
        versionNumber: 1,
        revisionToken: 'pr-101-concurrent-revision',
      };
      let conflicted = false;
      registerManagerApi();
      server.use(
        http.put(`${BASE_URL}/api/stored/agents/${AGENT_VERSION_LABELS_AGENT_ID}/labels/pr-101`, () => {
          onPut();
          conflicted = true;
          return HttpResponse.json(labelMoveConflict, { status: 409 });
        }),
        http.get(`${BASE_URL}/api/stored/agents/${AGENT_VERSION_LABELS_AGENT_ID}/labels`, () =>
          HttpResponse.json(
            conflicted
              ? { ...mutableManagerVersionLabels, labels: [...mutableManagerVersionLabels.labels, concurrentLabel] }
              : mutableManagerVersionLabels,
          ),
        ),
      );
      renderPanel();
      const dialog = await openCreateDialog();
      const input = within(dialog).getByRole('textbox', { name: 'Label name' });
      fireEvent.change(input, { target: { value: 'pr-101' } });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Create pr-101 for v3' }));

      expect(await within(dialog).findByText(/created by someone else and currently targets v1/)).not.toBeNull();
      expect(input.getAttribute('value')).toBe('pr-101');
      expect(onPut).toHaveBeenCalledOnce();
    });
  });

  describe('when the backend rejects a cached Create target as removed', () => {
    it('preserves the name and requires a fresh target selection before another submission', async () => {
      const onPut = vi.fn();
      registerManagerApi();
      server.use(
        http.put(`${BASE_URL}/api/stored/agents/${AGENT_VERSION_LABELS_AGENT_ID}/labels/release-candidate`, () => {
          onPut();
          return HttpResponse.json(versionNotFoundMutation, { status: 404 });
        }),
      );
      renderPanel();

      const dialog = await openCreateDialog();
      const nameInput = within(dialog).getByRole<HTMLInputElement>('textbox', { name: 'Label name' });
      fireEvent.change(nameInput, { target: { value: 'release-candidate' } });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Create release-candidate for v3' }));

      expect(
        await within(dialog).findByText(
          'The selected target version is no longer available. Choose a current version before trying again.',
        ),
      ).not.toBeNull();
      expect(nameInput.value).toBe('release-candidate');
      const blockedSubmit = within(dialog).getByRole<HTMLButtonElement>('button', {
        name: /Create release-candidate/,
      });
      expect(blockedSubmit.disabled).toBe(true);
      fireEvent.click(blockedSubmit);
      expect(onPut).toHaveBeenCalledOnce();

      await chooseTarget(dialog, 2);
      expect(
        within(dialog).getByRole<HTMLButtonElement>('button', { name: 'Create release-candidate for v2' }).disabled,
      ).toBe(false);
    });
  });

  describe('when a publisher moves a custom label', () => {
    it('sends the exact revision token last observed by Studio', async () => {
      let requestBody: unknown;
      let currentLabels = mutableManagerVersionLabels;
      registerManagerApi();
      server.use(
        http.put(
          `${BASE_URL}/api/stored/agents/${AGENT_VERSION_LABELS_AGENT_ID}/labels/preview`,
          async ({ request }) => {
            requestBody = await request.json();
            currentLabels = movedPreviewVersionLabels;
            const moved = movedPreviewVersionLabels.labels.find(label => label.name === 'preview');
            if (!moved) return new HttpResponse(null, { status: 500 });
            return HttpResponse.json(moved);
          },
        ),
        http.get(`${BASE_URL}/api/stored/agents/${AGENT_VERSION_LABELS_AGENT_ID}/labels`, () =>
          HttpResponse.json(currentLabels),
        ),
      );
      renderPanel();
      const manager = await openManager();
      fireEvent.click(await within(manager).findByRole('button', { name: 'Move preview from v1' }));
      const dialog = await screen.findByRole('dialog', { name: 'Move preview' });

      expect(within(dialog).getByRole('button', { name: 'Move preview from v1 to v1' }).hasAttribute('disabled')).toBe(
        true,
      );
      await chooseTarget(dialog, 2);
      fireEvent.click(within(dialog).getByRole('button', { name: 'Move preview from v1 to v2' }));

      await waitFor(() =>
        expect(requestBody).toEqual({ versionId: 'version-2', expectedRevisionToken: 'preview-revision-1' }),
      );
      expect(await screen.findByText('preview moved to v2.')).not.toBeNull();
    });
  });

  describe('when a custom label changes before a move commits', () => {
    it('does not retry until the operator reviews state, then uses the refreshed token', async () => {
      const requestBodies: unknown[] = [];
      let conflicted = false;
      registerManagerApi();
      server.use(
        http.put(
          `${BASE_URL}/api/stored/agents/${AGENT_VERSION_LABELS_AGENT_ID}/labels/preview`,
          async ({ request }) => {
            requestBodies.push(await request.json());
            if (!conflicted) {
              conflicted = true;
              return HttpResponse.json(labelMoveConflict, { status: 409 });
            }
            const moved = movedPreviewVersionLabels.labels.find(label => label.name === 'preview');
            if (!moved) return new HttpResponse(null, { status: 500 });
            return HttpResponse.json(moved);
          },
        ),
        http.get(`${BASE_URL}/api/stored/agents/${AGENT_VERSION_LABELS_AGENT_ID}/labels`, () =>
          HttpResponse.json(conflicted ? recreatedPreviewVersionLabels : mutableManagerVersionLabels),
        ),
      );
      renderPanel();
      const manager = await openManager();
      fireEvent.click(await within(manager).findByRole('button', { name: 'Move preview from v1' }));
      const dialog = await screen.findByRole('dialog', { name: 'Move preview' });
      await chooseTarget(dialog, 2);

      fireEvent.click(within(dialog).getByRole('button', { name: 'Move preview from v1 to v2' }));
      expect(await within(dialog).findByText(/now targets v3/)).not.toBeNull();
      expect(requestBodies).toHaveLength(1);
      const retry = within(dialog).getByRole('button', { name: 'Try moving preview from v3 to v2' });
      expect(retry.hasAttribute('disabled')).toBe(true);

      fireEvent.click(within(dialog).getByRole('button', { name: 'Review current state for preview at v3' }));
      fireEvent.click(retry);

      await waitFor(() => expect(requestBodies).toHaveLength(2));
      expect(requestBodies[1]).toEqual({
        versionId: 'version-2',
        expectedRevisionToken: 'preview-recreated-revision',
      });
    });
  });

  describe('when the backend rejects a cached Move target as removed', () => {
    it('requires a fresh target selection before another submission', async () => {
      const onPut = vi.fn();
      registerManagerApi();
      server.use(
        http.put(`${BASE_URL}/api/stored/agents/${AGENT_VERSION_LABELS_AGENT_ID}/labels/preview`, () => {
          onPut();
          return HttpResponse.json(versionNotFoundMutation, { status: 404 });
        }),
      );
      renderPanel();
      const manager = await openManager();
      fireEvent.click(await within(manager).findByRole('button', { name: 'Move preview from v1' }));
      const dialog = await screen.findByRole('dialog', { name: 'Move preview' });
      await chooseTarget(dialog, 3);
      fireEvent.click(within(dialog).getByRole('button', { name: 'Move preview from v1 to v3' }));

      expect(
        await within(dialog).findByText(
          'The selected target version is no longer available. Choose a current version before trying again.',
        ),
      ).not.toBeNull();
      const blockedSubmit = within(dialog).getByRole<HTMLButtonElement>('button', { name: /Move preview from v1/ });
      expect(blockedSubmit.disabled).toBe(true);
      fireEvent.click(blockedSubmit);
      expect(onPut).toHaveBeenCalledOnce();

      await chooseTarget(dialog, 2);
      expect(
        within(dialog).getByRole<HTMLButtonElement>('button', { name: 'Move preview from v1 to v2' }).disabled,
      ).toBe(false);
    });
  });

  describe('when conflict refresh fails after a stale move', () => {
    it('keeps the dialog open and prevents reuse of the stale revision token', async () => {
      const requestBodies: unknown[] = [];
      let conflicted = false;
      registerManagerApi();
      server.use(
        http.put(
          `${BASE_URL}/api/stored/agents/${AGENT_VERSION_LABELS_AGENT_ID}/labels/preview`,
          async ({ request }) => {
            requestBodies.push(await request.json());
            conflicted = true;
            return HttpResponse.json(labelMoveConflict, { status: 409 });
          },
        ),
        http.get(`${BASE_URL}/api/stored/agents/${AGENT_VERSION_LABELS_AGENT_ID}/labels`, () =>
          conflicted
            ? HttpResponse.json({ error: 'refresh failed' }, { status: 500 })
            : HttpResponse.json(mutableManagerVersionLabels),
        ),
      );
      renderPanel();
      const manager = await openManager();
      fireEvent.click(await within(manager).findByRole('button', { name: 'Move preview from v1' }));
      const dialog = await screen.findByRole('dialog', { name: 'Move preview' });
      await chooseTarget(dialog, 2);

      fireEvent.click(within(dialog).getByRole('button', { name: 'Move preview from v1 to v2' }));

      expect(await within(dialog).findByText(/couldn’t refresh current state/i)).not.toBeNull();
      const retry = within(dialog).getByRole('button', { name: 'Try moving preview from no version to v2' });
      expect(retry.hasAttribute('disabled')).toBe(true);
      fireEvent.click(retry);
      expect(requestBodies).toHaveLength(1);
      expect(screen.getByRole('dialog', { name: 'Move preview' })).not.toBeNull();
    });
  });

  describe('when a publisher deletes a custom label', () => {
    it('confirms the version is preserved and sends the observed token in the query', async () => {
      let expectedRevisionToken: string | null = null;
      let currentLabels = mutableManagerVersionLabels;
      registerManagerApi();
      server.use(
        http.delete(`${BASE_URL}/api/stored/agents/${AGENT_VERSION_LABELS_AGENT_ID}/labels/preview`, ({ request }) => {
          expectedRevisionToken = new URL(request.url).searchParams.get('expectedRevisionToken');
          currentLabels = {
            ...mutableManagerVersionLabels,
            labels: mutableManagerVersionLabels.labels.filter(label => label.name !== 'preview'),
          };
          return HttpResponse.json(deletedPreviewLabel);
        }),
        http.get(`${BASE_URL}/api/stored/agents/${AGENT_VERSION_LABELS_AGENT_ID}/labels`, () =>
          HttpResponse.json(currentLabels),
        ),
      );
      renderPanel();
      const manager = await openManager();
      fireEvent.click(await within(manager).findByRole('button', { name: 'Delete preview from v1' }));
      const dialog = await screen.findByRole('dialog', { name: 'Delete preview?' });

      expect(within(dialog).getByText(/The agent version is preserved/)).not.toBeNull();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete preview from v1' }));

      await waitFor(() => expect(expectedRevisionToken).toBe('preview-revision-1'));
      expect(await screen.findByText(/preview was deleted. v1 is preserved/)).not.toBeNull();
    });
  });

  describe('when a custom label is recreated before deletion commits', () => {
    it('requires review and deletes only with the recreated revision token', async () => {
      const observedTokens: Array<string | null> = [];
      let conflicted = false;
      registerManagerApi();
      server.use(
        http.delete(`${BASE_URL}/api/stored/agents/${AGENT_VERSION_LABELS_AGENT_ID}/labels/preview`, ({ request }) => {
          observedTokens.push(new URL(request.url).searchParams.get('expectedRevisionToken'));
          if (!conflicted) {
            conflicted = true;
            return HttpResponse.json(labelMoveConflict, { status: 409 });
          }
          return HttpResponse.json(deletedPreviewLabel);
        }),
        http.get(`${BASE_URL}/api/stored/agents/${AGENT_VERSION_LABELS_AGENT_ID}/labels`, () =>
          HttpResponse.json(conflicted ? recreatedPreviewVersionLabels : mutableManagerVersionLabels),
        ),
      );
      renderPanel();
      const manager = await openManager();
      fireEvent.click(await within(manager).findByRole('button', { name: 'Delete preview from v1' }));
      const dialog = await screen.findByRole('dialog', { name: 'Delete preview?' });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete preview from v1' }));

      expect(await within(dialog).findByText(/recreated or moved.*v3/)).not.toBeNull();
      expect(observedTokens).toEqual(['preview-revision-1']);
      const retry = within(dialog).getByRole('button', { name: 'Try deleting preview from v3' });
      expect(retry.hasAttribute('disabled')).toBe(true);
      fireEvent.click(within(dialog).getByRole('button', { name: 'Review current state for preview at v3' }));
      fireEvent.click(retry);

      await waitFor(() => expect(observedTokens).toHaveLength(2));
      expect(observedTokens[1]).toBe('preview-recreated-revision');
    });
  });

  describe('when a publisher promotes a newer version', () => {
    it('moves the pointer with the observed active ID and creates no version', async () => {
      let requestBody: unknown;
      const onCreateVersion = vi.fn();
      registerManagerApi();
      server.use(
        http.post(
          `${BASE_URL}/api/stored/agents/${AGENT_VERSION_LABELS_AGENT_ID}/versions/version-3/activate`,
          async ({ request }) => {
            requestBody = await request.json();
            return HttpResponse.json(activatedVersionThree);
          },
        ),
        http.post(`${BASE_URL}/api/stored/agents/${AGENT_VERSION_LABELS_AGENT_ID}/versions`, () => {
          onCreateVersion();
          return new HttpResponse(null, { status: 500 });
        }),
      );
      renderPanel();
      const manager = await openManager();
      fireEvent.click(within(manager).getByRole('button', { name: 'Promote v3 to Production' }));
      const dialog = await screen.findByRole('dialog', { name: 'Promote v3 to Production' });

      expect(within(dialog).getByText(/does not create a new version/)).not.toBeNull();
      expect(within(dialog).getByText('Release snapshot 3')).not.toBeNull();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Promote v3 to Production' }));

      await waitFor(() => expect(requestBody).toEqual({ expectedActiveVersionId: 'version-2' }));
      expect(onCreateVersion).not.toHaveBeenCalled();
    });
  });

  describe('when the backend rejects a cached Production target as removed', () => {
    it('keeps the confirmation open and blocks reuse of the removed target', async () => {
      const onActivate = vi.fn();
      registerManagerApi();
      server.use(
        http.post(`${BASE_URL}/api/stored/agents/${AGENT_VERSION_LABELS_AGENT_ID}/versions/version-3/activate`, () => {
          onActivate();
          return HttpResponse.json(versionNotFoundMutation, { status: 404 });
        }),
      );
      renderPanel();
      const manager = await openManager();
      fireEvent.click(within(manager).getByRole('button', { name: 'Promote v3 to Production' }));
      const dialog = await screen.findByRole('dialog', { name: 'Promote v3 to Production' });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Promote v3 to Production' }));

      expect(
        await within(dialog).findByText(
          'The selected target version is no longer available. Close this dialog and choose a current version.',
        ),
      ).not.toBeNull();
      const blockedSubmit = within(dialog).getByRole<HTMLButtonElement>('button', {
        name: 'Promote v3 to Production',
      });
      expect(blockedSubmit.disabled).toBe(true);
      fireEvent.click(blockedSubmit);
      expect(onActivate).toHaveBeenCalledOnce();
    });
  });

  describe('when no Production pointer exists', () => {
    it('uses a null observed precondition', async () => {
      let requestBody: unknown;
      registerManagerApi();
      server.use(
        http.post(
          `${BASE_URL}/api/stored/agents/${AGENT_VERSION_LABELS_AGENT_ID}/versions/version-3/activate`,
          async ({ request }) => {
            requestBody = await request.json();
            return HttpResponse.json(activatedVersionThree);
          },
        ),
      );
      renderPanel({ activeVersionId: undefined });
      const manager = await openManager();
      fireEvent.click(within(manager).getByRole('button', { name: 'Promote v3 to Production' }));
      const dialog = await screen.findByRole('dialog', { name: 'Promote v3 to Production' });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Promote v3 to Production' }));

      await waitFor(() => expect(requestBody).toEqual({ expectedActiveVersionId: null }));
    });
  });

  describe('when Production changes before promotion commits', () => {
    it('requires review and retries with the refreshed active ID', async () => {
      const requestBodies: unknown[] = [];
      let conflicted = false;
      registerManagerApi();
      server.use(
        http.post(
          `${BASE_URL}/api/stored/agents/${AGENT_VERSION_LABELS_AGENT_ID}/versions/version-3/activate`,
          async ({ request }) => {
            requestBodies.push(await request.json());
            if (!conflicted) {
              conflicted = true;
              return HttpResponse.json(productionMoveConflict, { status: 409 });
            }
            return HttpResponse.json(activatedVersionThree);
          },
        ),
        http.get(`${BASE_URL}/api/stored/agents/${AGENT_VERSION_LABELS_AGENT_ID}/versions`, () =>
          HttpResponse.json(
            conflicted
              ? {
                  ...mutationVersionHistory,
                  versions: mutationVersionHistory.versions.map(version => ({
                    ...version,
                    labels:
                      version.id === 'version-1'
                        ? ['production', ...version.labels.filter(label => label !== 'production')]
                        : version.labels.filter(label => label !== 'production'),
                  })),
                }
              : mutationVersionHistory,
          ),
        ),
      );
      renderPanel();
      const manager = await openManager();
      fireEvent.click(within(manager).getByRole('button', { name: 'Promote v3 to Production' }));
      const dialog = await screen.findByRole('dialog', { name: 'Promote v3 to Production' });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Promote v3 to Production' }));

      expect(await within(dialog).findByText(/now points to v1/)).not.toBeNull();
      expect(requestBodies).toHaveLength(1);
      const retry = within(dialog).getByRole('button', { name: 'Try again: Promote v3 to Production' });
      expect(retry.hasAttribute('disabled')).toBe(true);
      fireEvent.click(within(dialog).getByRole('button', { name: 'Review Production before moving to v3' }));
      fireEvent.click(retry);

      await waitFor(() => expect(requestBodies).toHaveLength(2));
      expect(requestBodies[1]).toEqual({ expectedActiveVersionId: 'version-1' });
    });

    it('refreshes every history page and retries with a current Production ID outside page one', async () => {
      const requestBodies: unknown[] = [];
      let conflicted = false;
      registerManagerApi();
      server.use(
        http.get(`${BASE_URL}/api/stored/agents/${AGENT_VERSION_LABELS_AGENT_ID}/versions`, ({ request }) => {
          const page = Number(new URL(request.url).searchParams.get('page'));
          if (page === 0) return HttpResponse.json(firstMutationVersionPage);
          return HttpResponse.json(conflicted ? concurrentSecondMutationVersionPage : secondMutationVersionPage);
        }),
        http.post(
          `${BASE_URL}/api/stored/agents/${AGENT_VERSION_LABELS_AGENT_ID}/versions/version-25/activate`,
          async ({ request }) => {
            requestBodies.push(await request.json());
            if (!conflicted) {
              conflicted = true;
              return HttpResponse.json(
                {
                  ...productionMoveConflict,
                  error: {
                    ...productionMoveConflict.error,
                    details: { currentActiveVersionId: 'version-1' },
                  },
                },
                { status: 409 },
              );
            }
            return HttpResponse.json({ ...activatedVersionThree, activeVersionId: 'version-25' });
          },
        ),
      );
      renderPanel({ activeVersionId: 'version-5' });
      const manager = await openManager();
      expect(within(manager).getByText('Production currently points to v5.')).not.toBeNull();
      expect(within(manager).getByRole('button', { name: 'Roll Back Production to v1' })).not.toBeNull();
      fireEvent.click(within(manager).getByRole('button', { name: 'Promote v25 to Production' }));
      const dialog = await screen.findByRole('dialog', { name: 'Promote v25 to Production' });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Promote v25 to Production' }));

      expect(await within(dialog).findByText(/now points to v1/)).not.toBeNull();
      expect(requestBodies).toEqual([{ expectedActiveVersionId: 'version-5' }]);
      fireEvent.click(within(dialog).getByRole('button', { name: 'Review Production before moving to v25' }));
      fireEvent.click(within(dialog).getByRole('button', { name: /Try again/ }));

      await waitFor(() => expect(requestBodies).toHaveLength(2));
      expect(requestBodies[1]).toEqual({ expectedActiveVersionId: 'version-1' });
    });
  });

  describe('when the server rejects a custom mutation with 403', () => {
    it('refreshes permissions without automatically retrying the request', async () => {
      const onPut = vi.fn();
      const onAuthorization = vi.fn();
      registerManagerApi();
      server.use(
        http.get(`${BASE_URL}/api/auth/capabilities`, () => {
          onAuthorization();
          return HttpResponse.json(versionLabelPublisherCapabilities);
        }),
        http.put(`${BASE_URL}/api/stored/agents/${AGENT_VERSION_LABELS_AGENT_ID}/labels/pr-101`, () => {
          onPut();
          return HttpResponse.json(forbiddenMutation, { status: 403 });
        }),
      );
      renderPanel();
      const dialog = await openCreateDialog();
      fireEvent.change(within(dialog).getByRole('textbox', { name: 'Label name' }), {
        target: { value: 'pr-101' },
      });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Create pr-101 for v3' }));

      expect(await within(dialog).findByText(/Couldn’t create the custom label/)).not.toBeNull();
      await waitFor(() => expect(onAuthorization.mock.calls.length).toBeGreaterThan(1));
      expect(onPut).toHaveBeenCalledOnce();
    });
  });

  describe('when the server reports custom labels unsupported', () => {
    it('refreshes capability discovery and preserves Production management', async () => {
      let unsupported = false;
      const onPut = vi.fn();
      registerManagerApi();
      server.use(
        http.get(`${BASE_URL}/api/system/packages`, () =>
          HttpResponse.json(unsupported ? unsupportedVersionLabelPackages : mutableVersionLabelPackages),
        ),
        http.put(`${BASE_URL}/api/stored/agents/${AGENT_VERSION_LABELS_AGENT_ID}/labels/pr-101`, () => {
          onPut();
          unsupported = true;
          return HttpResponse.json(unsupportedMutation, { status: 501 });
        }),
      );
      renderPanel();
      const dialog = await openCreateDialog();
      fireEvent.change(within(dialog).getByRole('textbox', { name: 'Label name' }), {
        target: { value: 'pr-101' },
      });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Create pr-101 for v3' }));

      expect(await screen.findByText(/Custom labels are not supported by this storage adapter/)).not.toBeNull();
      expect(within(dialog).getByRole<HTMLInputElement>('textbox', { name: 'Label name' }).value).toBe('pr-101');
      expect(within(dialog).getByRole<HTMLButtonElement>('button', { name: 'Create pr-101 for v3' }).disabled).toBe(
        true,
      );
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Create custom label' })).toBeNull());
      expect(screen.getByRole('button', { name: 'Promote v3 to Production' })).not.toBeNull();
      expect(onPut).toHaveBeenCalledOnce();
    });
  });

  describe('when the viewer lacks publishing access', () => {
    it('keeps the manager read-only', async () => {
      registerManagerApi();
      server.use(
        http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(versionLabelReaderCapabilities)),
      );
      renderPanel();

      expect(await screen.findByRole('button', { name: /^v3/ })).not.toBeNull();
      expect(screen.queryByRole('button', { name: /Add label here/ })).toBeNull();

      const manager = await openManager();
      await within(manager).findByRole('list', { name: 'Agent version labels' });
      expect(within(manager).queryByRole('button', { name: /Create|Move|Delete|Promote|Roll Back/ })).toBeNull();
      expect(within(manager).getByText(/Publishing access is required/)).not.toBeNull();
    });
  });

  describe('while publishing permissions are loading', () => {
    it('does not render the manager or any mutation affordance', async () => {
      let resolveAuthorization = (_value: typeof versionLabelPublisherCapabilities) => undefined;
      const authorization = new Promise<typeof versionLabelPublisherCapabilities>(resolve => {
        resolveAuthorization = resolve;
      });
      registerManagerApi();
      server.use(
        http.get(`${BASE_URL}/api/auth/capabilities`, async () => {
          const response = await authorization;
          return HttpResponse.json(response);
        }),
      );
      renderPanel();

      expect(await screen.findByRole('button', { name: /^v3/ })).not.toBeNull();
      expect(screen.queryByRole('button', { name: 'Manage labels' })).toBeNull();
      resolveAuthorization(versionLabelPublisherCapabilities);
      expect(await screen.findByRole('button', { name: 'Manage labels' })).not.toBeNull();
    });
  });

  describe('when publishing permission discovery fails', () => {
    it('shows a fail-closed retry state before restoring mutation controls', async () => {
      let shouldFail = true;
      registerManagerApi();
      server.use(
        http.get(`${BASE_URL}/api/auth/capabilities`, () => {
          if (shouldFail) return HttpResponse.json({ error: 'unavailable' }, { status: 500 });
          return HttpResponse.json(versionLabelPublisherCapabilities);
        }),
      );
      renderPanel();

      const manager = await openManager();
      expect(within(manager).getByText(/permissions are unavailable/)).not.toBeNull();
      expect(within(manager).queryByRole('button', { name: 'Create custom label' })).toBeNull();
      shouldFail = false;
      fireEvent.click(within(manager).getByRole('button', { name: 'Retry permissions' }));
      expect(await within(manager).findByRole('button', { name: 'Create custom label' })).not.toBeNull();
    });
  });

  describe('when an agent is source-provider-backed', () => {
    it('skips custom-label reads while retaining eligible Production activation', async () => {
      const onLabels = vi.fn();
      registerManagerApi();
      server.use(
        http.get(`${BASE_URL}/api/system/packages`, () => HttpResponse.json(sourceProviderVersionLabelPackages)),
        http.get(`${BASE_URL}/api/stored/agents/${AGENT_VERSION_LABELS_AGENT_ID}/labels`, () => {
          onLabels();
          return HttpResponse.json(mutableManagerVersionLabels);
        }),
      );
      renderPanel({ isSourceProviderBacked: true });

      expect(await screen.findByRole('button', { name: /^v3/ })).not.toBeNull();
      expect(screen.queryByRole('button', { name: /Add label here/ })).toBeNull();

      const manager = await openManager();
      expect(within(manager).getByText(/not supported for this source-provider-backed agent/)).not.toBeNull();
      expect(within(manager).queryByRole('list', { name: 'Agent version labels' })).toBeNull();
      expect(within(manager).queryByRole('button', { name: /Create|Move|Delete/ })).toBeNull();
      expect(within(manager).getByRole('button', { name: 'Promote v3 to Production' })).not.toBeNull();
      expect(within(manager).getByRole('button', { name: 'Roll Back Production to v1' })).not.toBeNull();
      expect(onLabels).not.toHaveBeenCalled();
    });
  });

  describe('when the custom-label read reports that the agent is missing or inaccessible', () => {
    it('shows the missing treatment without retrying the failed read', async () => {
      const onLabels = vi.fn();
      registerManagerApi();
      server.use(
        http.get(`${BASE_URL}/api/stored/agents/${AGENT_VERSION_LABELS_AGENT_ID}/labels`, () => {
          onLabels();
          return HttpResponse.json(managerAgentMissingError, { status: 404 });
        }),
      );
      renderPanel();

      const manager = await openManager();

      expect(await within(manager).findByText('Agent missing or inaccessible.')).not.toBeNull();
      expect(within(manager).queryByText(/Couldn’t load version labels/)).toBeNull();
      const settledRequestCount = onLabels.mock.calls.length;
      await new Promise(resolve => setTimeout(resolve, 25));
      expect(onLabels).toHaveBeenCalledTimes(settledRequestCount);
    });
  });

  describe('when the agent has no versions or custom labels', () => {
    it('explains the empty state without offering custom-label creation', async () => {
      registerManagerApi({
        labels: emptyManagerVersionLabels,
        versions: { versions: [], total: 0, page: 1, perPage: 20, hasMore: false },
      });
      renderPanel({ activeVersionId: undefined });

      const manager = await openManager();
      expect(within(manager).queryByRole('button', { name: 'Create custom label' })).toBeNull();
      expect(within(manager).getByText('No version labels found.')).not.toBeNull();
      expect(within(manager).getByText(/Save a version before managing labels or Production/)).not.toBeNull();
    });
  });

  describe('when versions exist but no custom label does', () => {
    it('offers creation and explains the empty custom channel', async () => {
      registerManagerApi({
        labels: {
          ...mutableManagerVersionLabels,
          labels: mutableManagerVersionLabels.labels.filter(label => label.kind !== 'custom'),
        },
      });
      renderPanel();

      const manager = await openManager();
      expect(
        await within(manager).findByText(
          'No custom labels yet. Custom labels are movable release channels that can point to any saved version.',
        ),
      ).not.toBeNull();
      expect(within(manager).getByRole('button', { name: 'Create custom label' }).hasAttribute('disabled')).toBe(false);
    });
  });
});
