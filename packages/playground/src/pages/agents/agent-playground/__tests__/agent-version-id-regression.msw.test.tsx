// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import AgentPlayground from '..';
import {
  AGENT_ID,
  codeAgent,
  storedAgentDraft,
  versionsList,
  versionLabelsList,
  agentExecutionCapabilities,
  firstPlaygroundVersionPage,
  LATEST_DRAFT_VERSION_ID,
  PAGINATED_OLDER_VERSION_ID,
  paginatedStoredAgentDraft,
  paginatedVersionLabelsList,
  PUBLISHED_VERSION_ID,
  secondPlaygroundVersionPage,
} from './fixtures/agent-version-id-regression';
import { agentVersionQueryKeys } from '@/domains/agents/hooks/agent-version-query-keys';
import { useDeleteAgentVersionLabel } from '@/domains/agents/hooks/use-agent-version-labels';
import { TracingSettingsProvider } from '@/domains/observability/context/tracing-settings-context';
import { SchemaRequestContextProvider } from '@/domains/request-context/context/schema-request-context';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const nestedRecord = (record: Record<string, unknown> | undefined, key: string) => {
  const value = record?.[key];
  return isRecord(value) ? value : undefined;
};

const resolvedVersionStream = (versionId: string) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({
            type: 'resolved-version-overrides',
            payload: { self: { versionId } },
          })}\n\n`,
        ),
      );
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'finish', payload: {} })}\n\n`));
      controller.close();
    },
  });

const createTestStorage = (): Storage => {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: key => values.get(key) ?? null,
    key: index => [...values.keys()][index] ?? null,
    removeItem: key => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
};

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

const renderAgentPlayground = (queryClient = createQueryClient(), companion?: ReactNode) => {
  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        {companion}
        <MemoryRouter initialEntries={[`/agents/${AGENT_ID}/editor`]}>
          <TooltipProvider>
            <TracingSettingsProvider entityId={AGENT_ID} entityType="agent">
              <SchemaRequestContextProvider>
                <Routes>
                  <Route path="/agents/:agentId/editor" element={<AgentPlayground />} />
                </Routes>
              </SchemaRequestContextProvider>
            </TracingSettingsProvider>
          </TooltipProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
};

const getRunTarget = (hidden = false) =>
  screen.getByRole<HTMLButtonElement>('combobox', { name: 'Run target', hidden });

const findEnabledRunTarget = async () => {
  await waitFor(() => expect(getRunTarget().disabled).toBe(false));
  return getRunTarget();
};

const findRunTargetContaining = async (text: string, hidden = false) => {
  await waitFor(() => expect(getRunTarget(hidden).textContent).toContain(text));
  return getRunTarget(hidden);
};

function DeleteSelectedLabelButton() {
  const mutation = useDeleteAgentVersionLabel({ agentId: AGENT_ID });

  return (
    <button
      type="button"
      onClick={() =>
        mutation.mutate({
          label: 'pr-101',
          input: { expectedRevisionToken: 'revision-pr-101-v2' },
        })
      }
    >
      Delete selected label
    </button>
  );
}

/** Endpoints AgentPlayground and its children hit that aren't the point of this test. */
const registerBaselineHandlers = () => {
  server.use(
    http.get(`${BASE_URL}/api/agents/${AGENT_ID}`, () => HttpResponse.json({ ...codeAgent, modelList: [] })),
    http.get(`${BASE_URL}/api/stored/agents/${AGENT_ID}/versions`, () => HttpResponse.json(versionsList)),
    http.get(`${BASE_URL}/api/stored/agents/${AGENT_ID}/labels`, () => HttpResponse.json(versionLabelsList)),
    http.get(`${BASE_URL}/api/stored/agents/${AGENT_ID}`, () => HttpResponse.json(storedAgentDraft)),
    http.get(`${BASE_URL}/api/memory/status`, () => HttpResponse.json({ result: false })),
    http.get(`${BASE_URL}/api/memory/config`, () => HttpResponse.json({ config: {} })),
    http.get(`${BASE_URL}/api/system/packages`, () =>
      HttpResponse.json({
        packages: [],
        isDev: true,
        cmsEnabled: true,
        observabilityEnabled: true,
        editorSource: 'code',
        storageCapabilities: {
          versionLabels: {
            entityTypes: {
              agent: { read: true, write: true, compareAndSwap: true, retentionProtection: true },
            },
          },
        },
      }),
    ),
    http.get(`${BASE_URL}/api/editor/builder/settings`, () => HttpResponse.json({ enabled: false })),
    http.get(`${BASE_URL}/api/editor/builder/models/available`, () => HttpResponse.json({ providers: [] })),
    http.get(`${BASE_URL}/api/agents/providers`, () => HttpResponse.json({ providers: [] })),
    http.get(`${BASE_URL}/api/agents/${AGENT_ID}/voice/speakers`, () => HttpResponse.json([])),
    http.get(`${BASE_URL}/api/agents/${AGENT_ID}/browser/session`, () =>
      HttpResponse.json({ hasSession: false, screencastAvailable: false }),
    ),
    http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json({ enabled: false, login: null })),
    http.post(`${BASE_URL}/api/agents/${AGENT_ID}/threads/subscribe`, () => HttpResponse.json({ ok: true })),
    http.get(`${BASE_URL}/api/tools`, () => HttpResponse.json({ tools: {} })),
    http.get(`${BASE_URL}/api/datasets`, () => HttpResponse.json({ datasets: [], total: 0, page: 1, perPage: 50 })),
    http.get(`${BASE_URL}/api/mcp/servers`, () => HttpResponse.json({ servers: {} })),
  );
};

const registerDatabaseEditorSource = () => {
  server.use(
    http.get(`${BASE_URL}/api/system/packages`, () =>
      HttpResponse.json({
        packages: [],
        isDev: true,
        cmsEnabled: true,
        observabilityEnabled: true,
        editorSource: 'db',
        editorSourceCapabilities: {
          source: 'db',
          storage: 'database',
          canSave: true,
          canOpenChangeRequest: false,
        },
        storageCapabilities: {
          versionLabels: {
            entityTypes: {
              agent: { read: true, write: true, compareAndSwap: true, retentionProtection: true },
            },
          },
        },
      }),
    ),
  );
};

beforeEach(() => {
  Object.defineProperty(window, 'localStorage', { configurable: true, value: createTestStorage() });
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  delete (window as Window & { MASTRA_AGENT_SIGNALS?: string }).MASTRA_AGENT_SIGNALS;
});

describe('AgentPlayground — test chat agent version id', () => {
  describe('when exact history and Production span more than one server page', () => {
    it('keeps an older exact target selectable and renders its vN identity for the current run', async () => {
      registerBaselineHandlers();
      window.MASTRA_AGENT_SIGNALS = 'false';
      const streamBodies: Record<string, unknown>[] = [];
      server.use(
        http.get(`${BASE_URL}/api/stored/agents/${AGENT_ID}/versions`, ({ request }) => {
          const page = Number(new URL(request.url).searchParams.get('page'));
          return HttpResponse.json(page === 0 ? firstPlaygroundVersionPage : secondPlaygroundVersionPage);
        }),
        http.get(`${BASE_URL}/api/stored/agents/${AGENT_ID}`, () => HttpResponse.json(paginatedStoredAgentDraft)),
        http.get(`${BASE_URL}/api/stored/agents/${AGENT_ID}/labels`, () =>
          HttpResponse.json(paginatedVersionLabelsList),
        ),
        http.post(`${BASE_URL}/api/agents/${AGENT_ID}/stream`, async ({ request }) => {
          const body: unknown = await request.json();
          if (isRecord(body)) streamBodies.push(body);
          return new HttpResponse(resolvedVersionStream(PAGINATED_OLDER_VERSION_ID), {
            status: 200,
            headers: { 'content-type': 'text/event-stream' },
          });
        }),
      );

      renderAgentPlayground();

      const runTarget = await findEnabledRunTarget();
      fireEvent.click(runTarget);
      const olderVersion = await screen.findByRole('option', { name: 'v1' });
      fireEvent.pointerDown(olderVersion, { pointerType: 'mouse' });
      fireEvent.click(olderVersion, { detail: 1 });
      const textarea = await screen.findByPlaceholderText<HTMLTextAreaElement>('Enter your message...');
      fireEvent.change(textarea, { target: { value: 'run the archived version' } });
      fireEvent.click(await screen.findByRole('button', { name: /send/i }));

      await waitFor(() => expect(streamBodies).toHaveLength(1));
      expect(nestedRecord(nestedRecord(streamBodies[0], 'versions'), 'self')).toEqual({
        versionId: PAGINATED_OLDER_VERSION_ID,
      });
      const currentRunLabel = await screen.findByText('Current run');
      expect(currentRunLabel.parentElement?.textContent).toContain('Current runv1');
      expect(screen.getByRole('button', { name: 'Copy resolved version ID for current run v1' })).not.toBeNull();
    });
  });

  describe('when the first immutable version appears without remounting the Playground', () => {
    it('adopts that exact version as the explicit run target', async () => {
      registerBaselineHandlers();
      let availableVersions: typeof versionsList = { ...versionsList, versions: [], total: 0 };
      const sentBodies: Record<string, unknown>[] = [];
      server.use(
        http.get(`${BASE_URL}/api/stored/agents/${AGENT_ID}/versions`, () => HttpResponse.json(availableVersions)),
        http.post(`${BASE_URL}/api/agents/${AGENT_ID}/send-message`, async ({ request }) => {
          const body: unknown = await request.json();
          if (isRecord(body)) sentBodies.push(body);
          return HttpResponse.json({ accepted: true, runId: 'run-first-version' });
        }),
      );

      const queryClient = createQueryClient();
      renderAgentPlayground(queryClient);
      await screen.findByPlaceholderText<HTMLTextAreaElement>('Enter your message...');

      const storedAgentQuery = queryClient
        .getQueryCache()
        .getAll()
        .find(query => query.queryKey[0] === 'stored-agent' && query.queryKey[1] === AGENT_ID);
      expect(storedAgentQuery).toBeDefined();
      await act(async () => {
        queryClient.setQueryData(storedAgentQuery!.queryKey, storedAgentDraft);
        availableVersions = versionsList;
        await queryClient.invalidateQueries({ queryKey: agentVersionQueryKeys.versionLists(AGENT_ID) });
      });

      const runTarget = await screen.findByRole('combobox', { name: 'Run target' });
      await waitFor(() => expect(runTarget.textContent).toContain('v2'));
      const textarea = await screen.findByPlaceholderText<HTMLTextAreaElement>('Enter your message...');
      fireEvent.change(textarea, { target: { value: 'run the first saved version' } });
      fireEvent.click(await screen.findByRole('button', { name: /send/i }));

      await waitFor(() => expect(sentBodies).toHaveLength(1));
      const streamOptions = nestedRecord(nestedRecord(sentBodies[0], 'ifIdle'), 'streamOptions');
      expect(nestedRecord(nestedRecord(streamOptions, 'versions'), 'self')).toEqual({
        versionId: LATEST_DRAFT_VERSION_ID,
      });
    });
  });

  describe('when Production changes while its confirmation is open', () => {
    it('refreshes, requires review, and retries the frozen target with the new CAS precondition', async () => {
      registerBaselineHandlers();
      const concurrentProductionVersionId = 'version-3-concurrent';
      const activationBodies: Record<string, unknown>[] = [];
      let currentActiveVersionId = PUBLISHED_VERSION_ID;

      server.use(
        http.get(`${BASE_URL}/api/system/packages`, () =>
          HttpResponse.json({
            packages: [],
            isDev: true,
            cmsEnabled: true,
            observabilityEnabled: true,
            editorSource: 'db',
            editorSourceCapabilities: {
              source: 'db',
              storage: 'database',
              canSave: true,
              canOpenChangeRequest: false,
            },
            storageCapabilities: {
              versionLabels: {
                entityTypes: {
                  agent: { read: true, write: true, compareAndSwap: true, retentionProtection: true },
                },
              },
            },
          }),
        ),
        http.get(`${BASE_URL}/api/stored/agents/${AGENT_ID}`, () =>
          HttpResponse.json({ ...storedAgentDraft, activeVersionId: currentActiveVersionId }),
        ),
        http.post(
          `${BASE_URL}/api/stored/agents/${AGENT_ID}/versions/${LATEST_DRAFT_VERSION_ID}/activate`,
          async ({ request }) => {
            const body: unknown = await request.json();
            if (isRecord(body)) activationBodies.push(body);
            if (activationBodies.length === 1) {
              currentActiveVersionId = concurrentProductionVersionId;
              return HttpResponse.json(
                {
                  error: {
                    code: 'LABEL_MOVE_CONFLICT',
                    message: 'Production changed after this dialog opened.',
                    details: {
                      label: 'production',
                      expectedActiveVersionId: PUBLISHED_VERSION_ID,
                      currentActiveVersionId,
                    },
                  },
                },
                { status: 409 },
              );
            }
            currentActiveVersionId = LATEST_DRAFT_VERSION_ID;
            return HttpResponse.json({
              success: true,
              message: 'Version activated',
              activeVersionId: LATEST_DRAFT_VERSION_ID,
            });
          },
        ),
      );

      renderAgentPlayground();

      fireEvent.click(await screen.findByRole('button', { name: 'Promote to Production v2' }));
      const confirmation = await screen.findByRole('alertdialog');
      expect(within(confirmation).getByText('Current production').nextElementSibling?.textContent).toBe('v1');
      expect(within(confirmation).getByText('Target version').nextElementSibling?.textContent).toBe('v2');
      fireEvent.click(within(confirmation).getByRole('button', { name: 'Promote to Production v2' }));

      expect(
        await within(confirmation).findByText(
          'Production changed while this dialog was open. It now points to Unknown production version.',
        ),
      ).not.toBeNull();
      expect(activationBodies).toEqual([{ expectedActiveVersionId: PUBLISHED_VERSION_ID }]);
      expect(
        (
          within(confirmation).getByRole('button', {
            name: 'Try again: Promote to Production v2',
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(true);

      fireEvent.click(
        within(confirmation).getByRole('button', { name: 'Review current Production before moving to v2' }),
      );
      fireEvent.click(within(confirmation).getByRole('button', { name: 'Try again: Promote to Production v2' }));

      await waitFor(() => expect(activationBodies).toHaveLength(2));
      expect(activationBodies[1]).toEqual({ expectedActiveVersionId: concurrentProductionVersionId });
      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    });
  });

  describe('when stored Production state cannot be loaded after version history succeeds', () => {
    it('shows an unknown retry state and keeps the target-specific Production action disabled', async () => {
      registerBaselineHandlers();
      registerDatabaseEditorSource();
      let shouldFail = true;
      let productionRequests = 0;
      server.use(
        http.get(`${BASE_URL}/api/stored/agents/${AGENT_ID}`, () => {
          productionRequests += 1;
          return shouldFail
            ? HttpResponse.json({ error: 'Production state unavailable' }, { status: 503 })
            : HttpResponse.json(storedAgentDraft);
        }),
      );

      renderAgentPlayground();

      expect(await screen.findByText('Production state is unknown. Retry before moving the pointer.')).not.toBeNull();
      const action = await screen.findByRole<HTMLButtonElement>('button', { name: 'Promote to Production v2' });
      expect(action.disabled).toBe(true);
      expect(screen.queryByText('No Production version is set.')).toBeNull();

      const requestsBeforeFailedRetry = productionRequests;
      fireEvent.click(screen.getByRole('button', { name: 'Retry Production state' }));
      await waitFor(() => expect(productionRequests).toBeGreaterThan(requestsBeforeFailedRetry));
      expect(await screen.findByText('Production state is unknown. Retry before moving the pointer.')).not.toBeNull();
      expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Promote to Production v2' }).disabled).toBe(true);

      shouldFail = false;
      fireEvent.click(screen.getByRole('button', { name: 'Retry Production state' }));

      await waitFor(() =>
        expect(screen.queryByText('Production state is unknown. Retry before moving the pointer.')).toBeNull(),
      );
      expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Promote to Production v2' }).disabled).toBe(false);
    });
  });

  describe('when Production activation reports version-label integrity corruption', () => {
    it('blocks Production and custom runs until labels, versions, and the stored pointer are refreshed', async () => {
      registerBaselineHandlers();
      registerDatabaseEditorSource();
      let activationRequests = 0;
      let labelRequests = 0;
      let versionRequests = 0;
      let productionRequests = 0;
      server.use(
        http.get(`${BASE_URL}/api/stored/agents/${AGENT_ID}/labels`, () => {
          labelRequests += 1;
          return HttpResponse.json(versionLabelsList);
        }),
        http.get(`${BASE_URL}/api/stored/agents/${AGENT_ID}/versions`, () => {
          versionRequests += 1;
          return HttpResponse.json(versionsList);
        }),
        http.get(`${BASE_URL}/api/stored/agents/${AGENT_ID}`, () => {
          productionRequests += 1;
          return HttpResponse.json(storedAgentDraft);
        }),
        http.post(`${BASE_URL}/api/stored/agents/${AGENT_ID}/versions/${LATEST_DRAFT_VERSION_ID}/activate`, () => {
          activationRequests += 1;
          return HttpResponse.json(
            {
              error: {
                code: 'VERSION_LABEL_INTEGRITY_ERROR',
                message: 'The version-label index is inconsistent.',
              },
            },
            { status: 500 },
          );
        }),
      );

      renderAgentPlayground();

      const runTarget = await findEnabledRunTarget();
      fireEvent.click(runTarget);
      const labelOption = await screen.findByRole('option', { name: 'pr-101 · v2' });
      fireEvent.pointerDown(labelOption, { pointerType: 'mouse' });
      fireEvent.click(labelOption, { detail: 1 });

      fireEvent.click(await screen.findByRole('button', { name: 'Promote to Production v2' }));
      const confirmation = await screen.findByRole('alertdialog');
      const confirm = within(confirmation).getByRole<HTMLButtonElement>('button', {
        name: 'Promote to Production v2',
      });
      fireEvent.click(confirm);

      expect(
        await within(confirmation).findByText(
          /Version-label integrity could not be verified\. Production stays disabled/,
        ),
      ).not.toBeNull();
      expect(confirm.disabled).toBe(true);
      expect(activationRequests).toBe(1);
      await findRunTargetContaining('pr-101 · unavailable', true);
      expect(
        await screen.findByPlaceholderText<HTMLTextAreaElement>(
          'Choose an available run target before sending a message',
        ),
      ).toHaveProperty('disabled', true);
      await waitFor(() => expect(labelRequests).toBeGreaterThanOrEqual(2));
      await waitFor(() => expect(versionRequests).toBeGreaterThanOrEqual(2));
      await waitFor(() => expect(productionRequests).toBeGreaterThanOrEqual(2));

      fireEvent.click(within(confirmation).getByRole('button', { name: 'Cancel' }));
      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());

      const labelsBeforeRetry = labelRequests;
      const versionsBeforeRetry = versionRequests;
      const productionBeforeRetry = productionRequests;
      fireEvent.click(screen.getByRole('button', { name: 'Retry version data for pr-101 · v2' }));

      await waitFor(() => expect(labelRequests).toBeGreaterThan(labelsBeforeRetry));
      await waitFor(() => expect(versionRequests).toBeGreaterThan(versionsBeforeRetry));
      await waitFor(() => expect(productionRequests).toBeGreaterThan(productionBeforeRetry));
      await waitFor(() => expect(screen.queryByText(/Version-label integrity could not be verified/)).toBeNull());
      expect(screen.getByPlaceholderText<HTMLTextAreaElement>('Enter your message...').disabled).toBe(false);
      expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Promote to Production v2' }).disabled).toBe(false);
      expect(activationRequests).toBe(1);
    });
  });

  describe('when viewing the latest version', () => {
    it('sends the latest draft through the canonical exact-version selector', async () => {
      registerBaselineHandlers();

      const sentBodies: Record<string, unknown>[] = [];
      server.use(
        http.post(`${BASE_URL}/api/agents/${AGENT_ID}/send-message`, async ({ request }) => {
          const body: unknown = await request.json();
          if (isRecord(body)) sentBodies.push(body);
          return HttpResponse.json({ accepted: true, runId: 'run-1' });
        }),
      );

      const queryClient = createQueryClient();
      await act(async () => {
        renderAgentPlayground(queryClient);
      });

      const textarea = await screen.findByPlaceholderText<HTMLTextAreaElement>('Enter your message...');
      await act(async () => {
        fireEvent.change(textarea, { target: { value: 'what version are you?' } });
      });

      const sendButton = await screen.findByRole('button', { name: /send/i });
      await act(async () => {
        fireEvent.click(sendButton);
      });

      await waitFor(() => expect(sentBodies.length).toBeGreaterThan(0));

      const ifIdle = nestedRecord(sentBodies[0], 'ifIdle');
      const streamOptions = nestedRecord(ifIdle, 'streamOptions');
      const versions = nestedRecord(streamOptions, 'versions');
      const self = nestedRecord(versions, 'self');
      const requestContext = nestedRecord(streamOptions, 'requestContext');

      expect(self).toEqual({ versionId: LATEST_DRAFT_VERSION_ID });
      expect(self?.versionId).not.toBe(PUBLISHED_VERSION_ID);
      expect(requestContext).not.toHaveProperty('agentVersionId');
    });
  });

  describe('when the executor selects a custom label', () => {
    it('sends the label without replacing it with the observed version id', async () => {
      registerBaselineHandlers();

      const sentBodies: Record<string, unknown>[] = [];
      server.use(
        http.post(`${BASE_URL}/api/agents/${AGENT_ID}/send-message`, async ({ request }) => {
          const body: unknown = await request.json();
          if (isRecord(body)) sentBodies.push(body);
          return HttpResponse.json({ accepted: true, runId: 'run-label' });
        }),
      );

      await act(async () => {
        renderAgentPlayground();
      });

      const runTarget = await findEnabledRunTarget();
      fireEvent.click(runTarget);
      const labelOption = await screen.findByRole('option', { name: 'pr-101 · v2' });
      fireEvent.pointerDown(labelOption, { pointerType: 'mouse' });
      fireEvent.click(labelOption, { detail: 1 });
      const selectedTargetInput = runTarget.parentElement?.querySelector<HTMLInputElement>('input');
      await waitFor(() => expect(selectedTargetInput?.value).toBe('label:pr-101'));

      const textarea = await screen.findByPlaceholderText<HTMLTextAreaElement>('Enter your message...');
      fireEvent.change(textarea, { target: { value: 'run the candidate' } });
      fireEvent.click(await screen.findByRole('button', { name: /send/i }));

      await waitFor(() => expect(sentBodies.length).toBeGreaterThan(0));

      const ifIdle = nestedRecord(sentBodies[0], 'ifIdle');
      const streamOptions = nestedRecord(ifIdle, 'streamOptions');
      const versions = nestedRecord(streamOptions, 'versions');

      expect(nestedRecord(versions, 'self')).toEqual({ label: 'pr-101' });
    });
  });

  describe('when the executor has read and execute access without publishing access', () => {
    it('runs a visible custom target without exposing Production controls', async () => {
      registerBaselineHandlers();
      let labelRequests = 0;
      const sentBodies: Record<string, unknown>[] = [];
      server.use(
        http.get(`${BASE_URL}/api/auth/capabilities`, () =>
          HttpResponse.json(
            agentExecutionCapabilities([
              `agents:read:${AGENT_ID}`,
              `agents:execute:${AGENT_ID}`,
              `stored-agents:read:${AGENT_ID}`,
            ]),
          ),
        ),
        http.get(`${BASE_URL}/api/stored/agents/${AGENT_ID}/labels`, () => {
          labelRequests += 1;
          return HttpResponse.json(versionLabelsList);
        }),
        http.post(`${BASE_URL}/api/agents/${AGENT_ID}/send-message`, async ({ request }) => {
          const body: unknown = await request.json();
          if (isRecord(body)) sentBodies.push(body);
          return HttpResponse.json({ accepted: true, runId: 'run-execute-only' });
        }),
      );

      renderAgentPlayground();

      const runTarget = await findEnabledRunTarget();
      fireEvent.click(runTarget);
      const labelOption = await screen.findByRole('option', { name: 'pr-101 · v2' });
      fireEvent.pointerDown(labelOption, { pointerType: 'mouse' });
      fireEvent.click(labelOption, { detail: 1 });

      const textarea = await screen.findByPlaceholderText<HTMLTextAreaElement>('Enter your message...');
      fireEvent.change(textarea, { target: { value: 'run the visible candidate' } });
      fireEvent.click(await screen.findByRole('button', { name: /send/i }));

      await waitFor(() => expect(sentBodies).toHaveLength(1));
      const streamOptions = nestedRecord(nestedRecord(sentBodies[0], 'ifIdle'), 'streamOptions');
      expect(nestedRecord(nestedRecord(streamOptions, 'versions'), 'self')).toEqual({ label: 'pr-101' });
      expect(labelRequests).toBeGreaterThan(0);
      expect(screen.queryByRole('button', { name: /Production/ })).toBeNull();
    });

    it('fails a cached custom target closed when stored-agent read access is revoked', async () => {
      registerBaselineHandlers();
      let canReadStoredAgent = true;
      server.use(
        http.get(`${BASE_URL}/api/auth/capabilities`, () =>
          HttpResponse.json(
            agentExecutionCapabilities([
              `agents:read:${AGENT_ID}`,
              `agents:execute:${AGENT_ID}`,
              ...(canReadStoredAgent ? [`stored-agents:read:${AGENT_ID}`] : []),
            ]),
          ),
        ),
      );
      const queryClient = createQueryClient();
      renderAgentPlayground(queryClient);

      const runTarget = await findEnabledRunTarget();
      fireEvent.click(runTarget);
      const labelOption = await screen.findByRole('option', { name: 'pr-101 · v2' });
      fireEvent.pointerDown(labelOption, { pointerType: 'mouse' });
      fireEvent.click(labelOption, { detail: 1 });

      canReadStoredAgent = false;
      await act(async () => {
        await queryClient.invalidateQueries({ queryKey: agentVersionQueryKeys.authorization });
      });

      const unavailableRunTarget = await findRunTargetContaining('pr-101 · unavailable');
      expect(
        await screen.findByPlaceholderText<HTMLTextAreaElement>(
          'Choose an available run target before sending a message',
        ),
      ).toHaveProperty('disabled', true);

      fireEvent.click(unavailableRunTarget);
      expect(await screen.findByRole('option', { name: 'production · v1' })).not.toBeNull();
      expect(await screen.findByRole('option', { name: 'latest · v2' })).not.toBeNull();
      expect(await screen.findByRole('option', { name: 'v2' })).not.toBeNull();
      expect(screen.queryByRole('option', { name: 'pr-101 · v2' })).toBeNull();
    });
  });

  describe('when the selected custom label is deleted before the next run', () => {
    it('tombstones a locally deleted target even when the confirming label refresh fails', async () => {
      registerBaselineHandlers();
      let deleteSucceeded = false;
      let deleteRequests = 0;
      let labelRequests = 0;
      server.use(
        http.delete(`${BASE_URL}/api/stored/agents/${AGENT_ID}/labels/pr-101`, ({ request }) => {
          expect(new URL(request.url).searchParams.get('expectedRevisionToken')).toBe('revision-pr-101-v2');
          deleteRequests += 1;
          deleteSucceeded = true;
          return HttpResponse.json({ success: true, deleted: true });
        }),
        http.get(`${BASE_URL}/api/stored/agents/${AGENT_ID}/labels`, () => {
          labelRequests += 1;
          return deleteSucceeded
            ? HttpResponse.json({ error: 'Label refresh unavailable' }, { status: 503 })
            : HttpResponse.json(versionLabelsList);
        }),
      );

      const queryClient = createQueryClient();
      renderAgentPlayground(queryClient, <DeleteSelectedLabelButton />);

      const runTarget = await findEnabledRunTarget();
      fireEvent.click(runTarget);
      const labelOption = await screen.findByRole('option', { name: 'pr-101 · v2' });
      fireEvent.pointerDown(labelOption, { pointerType: 'mouse' });
      fireEvent.click(labelOption, { detail: 1 });
      expect(await screen.findByPlaceholderText('Enter your message...')).not.toHaveProperty('disabled', true);

      const labelRequestsBeforeDelete = labelRequests;
      fireEvent.click(screen.getByRole('button', { name: 'Delete selected label' }));

      await waitFor(() => expect(deleteRequests).toBe(1));
      await waitFor(() => expect(labelRequests).toBeGreaterThan(labelRequestsBeforeDelete));
      expect(
        await screen.findByText('This run target is no longer available. Choose another target before running.'),
      ).not.toBeNull();
      await findRunTargetContaining('pr-101 · unavailable');
      expect(
        await screen.findByPlaceholderText<HTMLTextAreaElement>(
          'Choose an available run target before sending a message',
        ),
      ).toHaveProperty('disabled', true);
    });

    it('blocks the run instead of falling back to another version', async () => {
      registerBaselineHandlers();

      const sentBodies: Record<string, unknown>[] = [];
      server.use(
        http.post(`${BASE_URL}/api/agents/${AGENT_ID}/send-message`, async ({ request }) => {
          const body: unknown = await request.json();
          if (isRecord(body)) sentBodies.push(body);
          return HttpResponse.json({ accepted: true, runId: 'unexpected-run' });
        }),
      );

      const queryClient = createQueryClient();
      await act(async () => {
        renderAgentPlayground(queryClient);
      });

      const runTarget = await findEnabledRunTarget();
      fireEvent.click(runTarget);
      const labelOption = await screen.findByRole('option', { name: 'pr-101 · v2' });
      fireEvent.pointerDown(labelOption, { pointerType: 'mouse' });
      fireEvent.click(labelOption, { detail: 1 });

      server.use(
        http.get(`${BASE_URL}/api/stored/agents/${AGENT_ID}/labels`, () =>
          HttpResponse.json({
            ...versionLabelsList,
            labels: versionLabelsList.labels.filter(label => label.name !== 'pr-101'),
            pagination: { ...versionLabelsList.pagination, total: 2 },
          }),
        ),
      );
      await act(async () => {
        await queryClient.invalidateQueries({ queryKey: agentVersionQueryKeys.labelsRoot(AGENT_ID) });
      });

      expect(
        await screen.findByText('This run target is no longer available. Choose another target before running.'),
      ).not.toBeNull();
      await findRunTargetContaining('pr-101 · unavailable');
      const blockedTextarea = await screen.findByPlaceholderText<HTMLTextAreaElement>(
        'Choose an available run target before sending a message',
      );
      expect(blockedTextarea.hasAttribute('disabled')).toBe(true);
      expect(screen.queryByRole('button', { name: /send/i })).toBeNull();

      await new Promise(resolve => setTimeout(resolve, 25));
      expect(sentBodies).toHaveLength(0);
    });

    it('requires explicit reselection when the same label name is recreated', async () => {
      registerBaselineHandlers();
      let currentLabels = versionLabelsList;
      server.use(http.get(`${BASE_URL}/api/stored/agents/${AGENT_ID}/labels`, () => HttpResponse.json(currentLabels)));

      const queryClient = createQueryClient();
      renderAgentPlayground(queryClient);

      const runTarget = await findEnabledRunTarget();
      fireEvent.click(runTarget);
      const labelOption = await screen.findByRole('option', { name: 'pr-101 · v2' });
      fireEvent.pointerDown(labelOption, { pointerType: 'mouse' });
      fireEvent.click(labelOption, { detail: 1 });

      currentLabels = {
        ...versionLabelsList,
        labels: versionLabelsList.labels.filter(label => label.name !== 'pr-101'),
        pagination: { ...versionLabelsList.pagination, total: 2 },
      };
      await act(async () => {
        await queryClient.invalidateQueries({ queryKey: agentVersionQueryKeys.labelsRoot(AGENT_ID) });
      });
      await screen.findByText('This run target is no longer available. Choose another target before running.');

      currentLabels = {
        ...versionLabelsList,
        labels: versionLabelsList.labels.map(label =>
          label.name === 'pr-101'
            ? {
                ...label,
                versionId: PUBLISHED_VERSION_ID,
                versionNumber: 1,
                revisionToken: 'revision-pr-101-recreated-v1',
              }
            : label,
        ),
      };
      await act(async () => {
        await queryClient.invalidateQueries({ queryKey: agentVersionQueryKeys.labelsRoot(AGENT_ID) });
      });

      const blockedTextarea = await screen.findByPlaceholderText<HTMLTextAreaElement>(
        'Choose an available run target before sending a message',
      );
      expect(blockedTextarea.disabled).toBe(true);
      const unavailableRunTarget = await findRunTargetContaining('pr-101 · v1 · unavailable');

      fireEvent.click(unavailableRunTarget);
      const recreatedOption = await screen.findByRole('option', { name: 'pr-101 · v1' });
      fireEvent.pointerDown(recreatedOption, { pointerType: 'mouse' });
      fireEvent.click(recreatedOption, { detail: 1 });

      await waitFor(() =>
        expect(screen.getByPlaceholderText<HTMLTextAreaElement>('Enter your message...').disabled).toBe(false),
      );
    });
  });

  describe('when custom-label integrity fails during a background refresh', () => {
    it('fails a selected custom target closed while retaining computed and exact choices', async () => {
      registerBaselineHandlers();
      let hasIntegrityFailure = false;
      server.use(
        http.get(`${BASE_URL}/api/stored/agents/${AGENT_ID}/labels`, () =>
          hasIntegrityFailure
            ? HttpResponse.json(
                {
                  error: {
                    code: 'VERSION_LABEL_INTEGRITY_ERROR',
                    message: 'The version-label index is inconsistent.',
                  },
                },
                { status: 500 },
              )
            : HttpResponse.json(versionLabelsList),
        ),
      );
      const queryClient = createQueryClient();
      renderAgentPlayground(queryClient);

      const runTarget = await findEnabledRunTarget();
      fireEvent.click(runTarget);
      const labelOption = await screen.findByRole('option', { name: 'pr-101 · v2' });
      fireEvent.pointerDown(labelOption, { pointerType: 'mouse' });
      fireEvent.click(labelOption, { detail: 1 });

      hasIntegrityFailure = true;
      await act(async () => {
        await queryClient.invalidateQueries({ queryKey: agentVersionQueryKeys.labelsRoot(AGENT_ID) });
      });

      const unavailableRunTarget = await findRunTargetContaining('pr-101 · unavailable');
      expect(
        await screen.findByPlaceholderText<HTMLTextAreaElement>(
          'Choose an available run target before sending a message',
        ),
      ).toHaveProperty('disabled', true);

      fireEvent.click(unavailableRunTarget);
      expect(await screen.findByRole('option', { name: 'production · v1' })).not.toBeNull();
      expect(await screen.findByRole('option', { name: 'latest · v2' })).not.toBeNull();
      expect(await screen.findByRole('option', { name: 'v2' })).not.toBeNull();
      expect(screen.queryByRole('option', { name: 'pr-101 · v2' })).toBeNull();
      expect(
        screen.getByText(
          'Version-label integrity could not be verified. Custom labels are unavailable; Production, Latest, and exact versions remain available.',
        ),
      ).not.toBeNull();

      fireEvent.click(getRunTarget());
      hasIntegrityFailure = false;
      fireEvent.click(screen.getByRole('button', { name: 'Retry version data for pr-101 · v2' }));
      await waitFor(() =>
        expect(
          screen.queryByText(
            'Version-label integrity could not be verified. Custom labels are unavailable; Production, Latest, and exact versions remain available.',
          ),
        ).toBeNull(),
      );
    });
  });

  describe('when a background custom-label refresh fails with previously verified data', () => {
    it('keeps the stale target usable and offers an explicit retry beside the selector', async () => {
      registerBaselineHandlers();
      let shouldFail = false;
      server.use(
        http.get(`${BASE_URL}/api/stored/agents/${AGENT_ID}/labels`, () =>
          shouldFail
            ? HttpResponse.json({ error: 'labels temporarily unavailable' }, { status: 503 })
            : HttpResponse.json(versionLabelsList),
        ),
      );
      const queryClient = createQueryClient();
      renderAgentPlayground(queryClient);

      const runTarget = await findEnabledRunTarget();
      fireEvent.click(runTarget);
      const labelOption = await screen.findByRole('option', { name: 'pr-101 · v2' });
      fireEvent.pointerDown(labelOption, { pointerType: 'mouse' });
      fireEvent.click(labelOption, { detail: 1 });
      shouldFail = true;
      await act(async () => {
        await queryClient.invalidateQueries({ queryKey: agentVersionQueryKeys.labelsRoot(AGENT_ID) });
      });

      expect(
        await screen.findByText('Version labels may be out of date. Studio is keeping the last verified targets.'),
      ).not.toBeNull();
      expect(runTarget.textContent).toContain('pr-101 · v2');
      expect((await screen.findByPlaceholderText('Enter your message...')).hasAttribute('disabled')).toBe(false);
      shouldFail = false;
      fireEvent.click(screen.getByRole('button', { name: 'Retry version labels for pr-101 · v2' }));

      await waitFor(() =>
        expect(
          screen.queryByText('Version labels may be out of date. Studio is keeping the last verified targets.'),
        ).toBeNull(),
      );
      expect(runTarget.textContent).toContain('pr-101 · v2');
    });
  });

  describe('when the label endpoint reports that the agent is missing', () => {
    it('replaces cached custom-target UI with the missing-or-inaccessible state', async () => {
      registerBaselineHandlers();
      let isMissing = false;
      server.use(
        http.get(`${BASE_URL}/api/stored/agents/${AGENT_ID}/labels`, () =>
          isMissing
            ? HttpResponse.json(
                { error: { code: 'ENTITY_NOT_FOUND', message: 'The agent no longer exists or is inaccessible.' } },
                { status: 404 },
              )
            : HttpResponse.json(versionLabelsList),
        ),
      );
      const queryClient = createQueryClient();
      renderAgentPlayground(queryClient);

      const runTarget = await findEnabledRunTarget();
      fireEvent.click(runTarget);
      expect(await screen.findByRole('option', { name: 'pr-101 · v2' })).not.toBeNull();
      fireEvent.click(runTarget);

      isMissing = true;
      await act(async () => {
        await queryClient.invalidateQueries({ queryKey: agentVersionQueryKeys.labelsRoot(AGENT_ID) });
      });

      expect(await screen.findByText(/Agent (?:missing or inaccessible|not found)/)).not.toBeNull();
      expect(screen.queryByRole('combobox', { name: 'Run target' })).toBeNull();
      expect(
        screen.queryByText('Version labels may be out of date. Studio is keeping the last verified targets.'),
      ).toBeNull();
    });
  });

  describe('when the server rejects the selected run target', () => {
    it('shows a missing-or-inaccessible state and sends no fallback when the agent disappears', async () => {
      registerBaselineHandlers();
      let sendRequests = 0;
      let fallbackRequests = 0;
      server.use(
        http.post(`${BASE_URL}/api/agents/${AGENT_ID}/send-message`, () => {
          sendRequests += 1;
          return HttpResponse.json(
            { error: { code: 'ENTITY_NOT_FOUND', message: 'The agent no longer exists or is inaccessible.' } },
            { status: 404 },
          );
        }),
        http.post(`${BASE_URL}/api/agents/${AGENT_ID}/signals`, () => {
          fallbackRequests += 1;
          return HttpResponse.json({ accepted: true, runId: 'unexpected-fallback' });
        }),
      );

      renderAgentPlayground();

      const textarea = await screen.findByPlaceholderText<HTMLTextAreaElement>('Enter your message...');
      fireEvent.change(textarea, { target: { value: 'run after deletion' } });
      fireEvent.click(await screen.findByRole('button', { name: /send/i }));

      expect(await screen.findByText('Agent missing or inaccessible')).not.toBeNull();
      expect(
        screen.getByText('This agent no longer exists or you no longer have access. New runs are disabled.'),
      ).not.toBeNull();
      expect(screen.queryByPlaceholderText('Enter your message...')).toBeNull();
      expect(sendRequests).toBe(1);
      expect(fallbackRequests).toBe(0);
    });

    it('keeps a missing label selected, refreshes version state, and blocks retry without fallback', async () => {
      registerBaselineHandlers();

      const sentBodies: Record<string, unknown>[] = [];
      let labelRequests = 0;
      let versionRequests = 0;
      server.use(
        http.get(`${BASE_URL}/api/stored/agents/${AGENT_ID}/labels`, () => {
          labelRequests += 1;
          return HttpResponse.json(versionLabelsList);
        }),
        http.get(`${BASE_URL}/api/stored/agents/${AGENT_ID}/versions`, () => {
          versionRequests += 1;
          return HttpResponse.json(versionsList);
        }),
        http.post(`${BASE_URL}/api/agents/${AGENT_ID}/send-message`, async ({ request }) => {
          const body: unknown = await request.json();
          if (isRecord(body)) sentBodies.push(body);
          return HttpResponse.json(
            { error: { code: 'LABEL_NOT_FOUND', message: 'The selected label no longer exists.' } },
            { status: 404 },
          );
        }),
      );

      renderAgentPlayground();

      const runTarget = await findEnabledRunTarget();
      fireEvent.click(runTarget);
      const labelOption = await screen.findByRole('option', { name: 'pr-101 · v2' });
      fireEvent.pointerDown(labelOption, { pointerType: 'mouse' });
      fireEvent.click(labelOption, { detail: 1 });

      const initialLabelRequests = labelRequests;
      const initialVersionRequests = versionRequests;
      const textarea = await screen.findByPlaceholderText<HTMLTextAreaElement>('Enter your message...');
      fireEvent.change(textarea, { target: { value: 'run a removed label' } });
      fireEvent.click(await screen.findByRole('button', { name: /send/i }));

      await waitFor(() => expect(sentBodies).toHaveLength(1));
      const unavailableRunTarget = await findRunTargetContaining('pr-101 · v2 · unavailable');
      expect(
        await screen.findByText('This run target is no longer available. Choose another target before running.'),
      ).not.toBeNull();
      expect(
        (
          await screen.findByPlaceholderText<HTMLTextAreaElement>(
            'Choose an available run target before sending a message',
          )
        ).hasAttribute('disabled'),
      ).toBe(true);
      await waitFor(() => expect(labelRequests).toBeGreaterThan(initialLabelRequests));
      await waitFor(() => expect(versionRequests).toBeGreaterThan(initialVersionRequests));

      const streamOptions = nestedRecord(nestedRecord(sentBodies[0], 'ifIdle'), 'streamOptions');
      expect(nestedRecord(nestedRecord(streamOptions, 'versions'), 'self')).toEqual({ label: 'pr-101' });
      expect(screen.queryByRole('button', { name: /send/i })).toBeNull();
      await new Promise(resolve => setTimeout(resolve, 25));
      expect(sentBodies).toHaveLength(1);

      fireEvent.click(unavailableRunTarget);
      const productionOption = await screen.findByRole('option', { name: 'production · v1' });
      fireEvent.pointerDown(productionOption, { pointerType: 'mouse' });
      fireEvent.click(productionOption, { detail: 1 });
      await waitFor(() =>
        expect(
          screen.queryByText('This run target is no longer available. Choose another target before running.'),
        ).toBeNull(),
      );
      expect((await screen.findByPlaceholderText('Enter your message...')).hasAttribute('disabled')).toBe(false);
    });

    it('keeps a missing exact version selected and does not retry or run the default version', async () => {
      registerBaselineHandlers();

      const sentBodies: Record<string, unknown>[] = [];
      server.use(
        http.post(`${BASE_URL}/api/agents/${AGENT_ID}/send-message`, async ({ request }) => {
          const body: unknown = await request.json();
          if (isRecord(body)) sentBodies.push(body);
          return HttpResponse.json(
            { error: { code: 'VERSION_NOT_FOUND', message: 'The selected version no longer exists.' } },
            { status: 404 },
          );
        }),
      );

      renderAgentPlayground();

      const textarea = await screen.findByPlaceholderText<HTMLTextAreaElement>('Enter your message...');
      fireEvent.change(textarea, { target: { value: 'run an exact version' } });
      fireEvent.click(await screen.findByRole('button', { name: /send/i }));

      await waitFor(() => expect(sentBodies).toHaveLength(1));
      const runTarget = await screen.findByRole('combobox', { name: 'Run target' });
      await waitFor(() => expect(runTarget.textContent).toContain('v2 · unavailable'));
      expect(
        (
          await screen.findByPlaceholderText<HTMLTextAreaElement>(
            'Choose an available run target before sending a message',
          )
        ).hasAttribute('disabled'),
      ).toBe(true);

      const streamOptions = nestedRecord(nestedRecord(sentBodies[0], 'ifIdle'), 'streamOptions');
      expect(nestedRecord(nestedRecord(streamOptions, 'versions'), 'self')).toEqual({
        versionId: LATEST_DRAFT_VERSION_ID,
      });
      expect(screen.queryByRole('button', { name: /send/i })).toBeNull();
      await new Promise(resolve => setTimeout(resolve, 25));
      expect(sentBodies).toHaveLength(1);
    });

    it('keeps a live integrity rejection fail-closed until explicit version data refresh succeeds', async () => {
      registerBaselineHandlers();
      let sendRequests = 0;
      let fallbackSignalRequests = 0;
      let labelRequests = 0;
      let versionRequests = 0;
      server.use(
        http.get(`${BASE_URL}/api/stored/agents/${AGENT_ID}/labels`, () => {
          labelRequests += 1;
          return HttpResponse.json(versionLabelsList);
        }),
        http.get(`${BASE_URL}/api/stored/agents/${AGENT_ID}/versions`, () => {
          versionRequests += 1;
          return HttpResponse.json(versionsList);
        }),
        http.post(`${BASE_URL}/api/agents/${AGENT_ID}/send-message`, () => {
          sendRequests += 1;
          return HttpResponse.json(
            {
              error: {
                code: 'VERSION_LABEL_INTEGRITY_ERROR',
                message: 'The version-label index is inconsistent.',
              },
            },
            { status: 500 },
          );
        }),
        http.post(`${BASE_URL}/api/agents/${AGENT_ID}/signals`, () => {
          fallbackSignalRequests += 1;
          return HttpResponse.json({ accepted: true, runId: 'unexpected-fallback' });
        }),
      );

      renderAgentPlayground();

      const runTarget = await findEnabledRunTarget();
      fireEvent.click(runTarget);
      const labelOption = await screen.findByRole('option', { name: 'pr-101 · v2' });
      fireEvent.pointerDown(labelOption, { pointerType: 'mouse' });
      fireEvent.click(labelOption, { detail: 1 });

      const initialLabelRequests = labelRequests;
      const initialVersionRequests = versionRequests;
      const textarea = await screen.findByPlaceholderText<HTMLTextAreaElement>('Enter your message...');
      fireEvent.change(textarea, { target: { value: 'run an inconsistent label index' } });
      fireEvent.click(await screen.findByRole('button', { name: /send/i }));

      await waitFor(() => expect(sendRequests).toBe(1));
      await waitFor(() => expect(labelRequests).toBeGreaterThan(initialLabelRequests));
      await waitFor(() => expect(versionRequests).toBeGreaterThan(initialVersionRequests));
      expect(fallbackSignalRequests).toBe(0);
      await findRunTargetContaining('pr-101 · unavailable');
      expect(
        await screen.findByText(
          'Version-label integrity could not be verified. Custom labels are unavailable; Production, Latest, and exact versions remain available.',
        ),
      ).not.toBeNull();
      expect(
        screen.getByText('Retry labels and version history. If the problem continues, contact support.'),
      ).not.toBeNull();
      expect(
        await screen.findByPlaceholderText<HTMLTextAreaElement>(
          'Choose an available run target before sending a message',
        ),
      ).toHaveProperty('disabled', true);

      const labelsBeforeRetry = labelRequests;
      const versionsBeforeRetry = versionRequests;
      fireEvent.click(screen.getByRole('button', { name: 'Retry version data for pr-101 · v2' }));

      await waitFor(() => expect(labelRequests).toBeGreaterThan(labelsBeforeRetry));
      await waitFor(() => expect(versionRequests).toBeGreaterThan(versionsBeforeRetry));
      await waitFor(() =>
        expect(
          screen.queryByText(
            'Version-label integrity could not be verified. Custom labels are unavailable; Production, Latest, and exact versions remain available.',
          ),
        ).toBeNull(),
      );
      await findRunTargetContaining('pr-101 · v2');
      expect(getRunTarget().textContent).not.toContain('unavailable');
      expect((await screen.findByPlaceholderText('Enter your message...')).hasAttribute('disabled')).toBe(false);
      expect(sendRequests).toBe(1);
    });

    it('refreshes unsupported-label capability and makes exactly one run request without fallback', async () => {
      registerBaselineHandlers();
      let packageRequests = 0;
      let sendRequests = 0;
      let fallbackSignalRequests = 0;
      let reportUnsupported = false;
      server.use(
        http.get(`${BASE_URL}/api/system/packages`, () => {
          packageRequests += 1;
          return HttpResponse.json({
            packages: [],
            isDev: true,
            cmsEnabled: true,
            observabilityEnabled: true,
            editorSource: 'code',
            storageCapabilities: {
              versionLabels: {
                entityTypes: {
                  agent: !reportUnsupported
                    ? { read: true, write: true, compareAndSwap: true, retentionProtection: true }
                    : { read: false, write: false, compareAndSwap: false, retentionProtection: false },
                },
              },
            },
          });
        }),
        http.post(`${BASE_URL}/api/agents/${AGENT_ID}/send-message`, () => {
          sendRequests += 1;
          reportUnsupported = true;
          return HttpResponse.json(
            { error: { code: 'VERSION_LABELS_UNSUPPORTED', message: 'Version labels are unsupported.' } },
            { status: 501 },
          );
        }),
        http.post(`${BASE_URL}/api/agents/${AGENT_ID}/signals`, () => {
          fallbackSignalRequests += 1;
          return HttpResponse.json({ accepted: true, runId: 'unexpected-fallback' });
        }),
      );

      renderAgentPlayground();

      const runTarget = await findEnabledRunTarget();
      fireEvent.click(runTarget);
      const labelOption = await screen.findByRole('option', { name: 'pr-101 · v2' });
      fireEvent.pointerDown(labelOption, { pointerType: 'mouse' });
      fireEvent.click(labelOption, { detail: 1 });
      const textarea = await screen.findByPlaceholderText<HTMLTextAreaElement>('Enter your message...');
      fireEvent.change(textarea, { target: { value: 'run unsupported label' } });
      fireEvent.click(await screen.findByRole('button', { name: /send/i }));

      await waitFor(() => expect(packageRequests).toBeGreaterThan(1));
      await findRunTargetContaining('pr-101 · unavailable');
      expect(sendRequests).toBe(1);
      expect(fallbackSignalRequests).toBe(0);
      expect(
        (
          await screen.findByPlaceholderText<HTMLTextAreaElement>(
            'Choose an available run target before sending a message',
          )
        ).hasAttribute('disabled'),
      ).toBe(true);
    });

    it('refreshes live authorization and blocks after exactly one forbidden run request', async () => {
      registerBaselineHandlers();
      let authorizationRequests = 0;
      let sendRequests = 0;
      let fallbackSignalRequests = 0;
      server.use(
        http.get(`${BASE_URL}/api/auth/capabilities`, () => {
          authorizationRequests += 1;
          return HttpResponse.json(
            agentExecutionCapabilities(
              authorizationRequests === 1 ? [`agents:execute:${AGENT_ID}`, `stored-agents:read:${AGENT_ID}`] : [],
            ),
          );
        }),
        http.post(`${BASE_URL}/api/agents/${AGENT_ID}/send-message`, () => {
          sendRequests += 1;
          return HttpResponse.json(
            { error: { code: 'FORBIDDEN', message: 'Execution access was revoked.' } },
            { status: 403 },
          );
        }),
        http.post(`${BASE_URL}/api/agents/${AGENT_ID}/signals`, () => {
          fallbackSignalRequests += 1;
          return HttpResponse.json({ accepted: true, runId: 'unexpected-fallback' });
        }),
      );

      renderAgentPlayground();

      const textarea = await screen.findByPlaceholderText<HTMLTextAreaElement>('Enter your message...');
      fireEvent.change(textarea, { target: { value: 'run after revocation' } });
      fireEvent.click(await screen.findByRole('button', { name: /send/i }));

      await waitFor(() => expect(authorizationRequests).toBeGreaterThan(1));
      expect(sendRequests).toBe(1);
      expect(fallbackSignalRequests).toBe(0);
      expect(
        (
          await screen.findByPlaceholderText<HTMLTextAreaElement>("You don't have permission to execute this agent")
        ).hasAttribute('disabled'),
      ).toBe(true);
    });
  });

  describe('when a code agent is backed by a source provider', () => {
    it('keeps computed and exact targets without requesting custom labels', async () => {
      registerBaselineHandlers();
      let labelRequests = 0;
      server.use(
        http.get(`${BASE_URL}/api/system/packages`, () =>
          HttpResponse.json({
            packages: [],
            isDev: true,
            cmsEnabled: true,
            observabilityEnabled: true,
            editorSource: 'code',
            editorSourceCapabilities: {
              source: 'code',
              storage: 'source-provider',
              provider: { id: 'github', displayName: 'GitHub' },
              canSave: true,
              canOpenChangeRequest: true,
            },
            storageCapabilities: {
              versionLabels: {
                entityTypes: {
                  agent: { read: true, write: true, compareAndSwap: true, retentionProtection: true },
                },
              },
            },
          }),
        ),
        http.get(`${BASE_URL}/api/stored/agents/${AGENT_ID}/labels`, () => {
          labelRequests += 1;
          return HttpResponse.json(versionLabelsList);
        }),
      );

      renderAgentPlayground();

      const runTarget = await findEnabledRunTarget();
      fireEvent.click(runTarget);

      expect(await screen.findByRole('option', { name: 'production · v1' })).not.toBeNull();
      expect(await screen.findByRole('option', { name: 'latest · v2' })).not.toBeNull();
      expect(screen.queryByRole('option', { name: 'pr-101 · v2' })).toBeNull();
      expect(labelRequests).toBe(0);
    });
  });

  describe('when execution authorization discovery fails', () => {
    it('blocks new runs instead of treating missing authorization data as disabled RBAC', async () => {
      registerBaselineHandlers();
      server.use(
        http.get(`${BASE_URL}/api/auth/capabilities`, () =>
          HttpResponse.json({ error: 'authorization unavailable' }, { status: 503 }),
        ),
      );

      renderAgentPlayground();

      const blockedTextarea = await screen.findByPlaceholderText<HTMLTextAreaElement>(
        'Agent execution access could not be verified',
      );
      expect(blockedTextarea.hasAttribute('disabled')).toBe(true);
      expect(screen.queryByRole('button', { name: /send/i })).toBeNull();
    });
  });

  describe('when stored-agent version discovery fails', () => {
    it('blocks execution with explicit version-loading error copy instead of using the default agent', async () => {
      registerBaselineHandlers();
      let runRequests = 0;
      server.use(
        http.get(`${BASE_URL}/api/stored/agents/${AGENT_ID}/versions`, () =>
          HttpResponse.json({ error: 'versions unavailable' }, { status: 403 }),
        ),
        http.post(`${BASE_URL}/api/agents/${AGENT_ID}/send-message`, () => {
          runRequests += 1;
          return HttpResponse.json({ accepted: true, runId: 'unexpected-run' });
        }),
      );

      renderAgentPlayground();

      expect(await screen.findByText('Agent versions could not be loaded. Retry before running.')).not.toBeNull();
      expect(screen.getByText('Running is disabled to avoid using an unintended version.')).not.toBeNull();
      expect(screen.queryByRole('textbox')).toBeNull();
      expect(screen.queryByRole('button', { name: /send/i })).toBeNull();
      expect(runRequests).toBe(0);
    });

    it('keeps the selected target while cached history is stale and recovers through a targeted retry', async () => {
      registerBaselineHandlers();
      let shouldFail = false;
      server.use(
        http.get(`${BASE_URL}/api/stored/agents/${AGENT_ID}/versions`, () =>
          shouldFail
            ? HttpResponse.json({ error: 'versions temporarily unavailable' }, { status: 503 })
            : HttpResponse.json(versionsList),
        ),
      );
      const queryClient = createQueryClient();
      renderAgentPlayground(queryClient);
      const runTarget = await screen.findByRole('combobox', { name: 'Run target' });
      await waitFor(() => expect(runTarget.textContent).toContain('v2'));
      shouldFail = true;

      await act(async () => {
        await queryClient.invalidateQueries({ queryKey: agentVersionQueryKeys.versionLists(AGENT_ID) });
      });

      expect(
        await screen.findByText('Version history may be out of date. New runs are disabled until it refreshes.'),
      ).not.toBeNull();
      expect(runTarget.textContent).toContain('v2');
      expect(
        (
          await screen.findByPlaceholderText<HTMLTextAreaElement>(
            'Agent versions could not be loaded. Retry before running.',
          )
        ).hasAttribute('disabled'),
      ).toBe(true);
      shouldFail = false;
      fireEvent.click(screen.getByRole('button', { name: 'Retry version history for v2' }));

      await waitFor(() =>
        expect(
          screen.queryByText('Version history may be out of date. New runs are disabled until it refreshes.'),
        ).toBeNull(),
      );
      expect(runTarget.textContent).toContain('v2');
      expect((await screen.findByPlaceholderText('Enter your message...')).hasAttribute('disabled')).toBe(false);
    });

    it('recovers through an explicit version-history retry', async () => {
      registerBaselineHandlers();
      let shouldFail = true;
      server.use(
        http.get(`${BASE_URL}/api/stored/agents/${AGENT_ID}/versions`, () =>
          shouldFail
            ? HttpResponse.json({ error: 'versions unavailable' }, { status: 503 })
            : HttpResponse.json(versionsList),
        ),
      );

      renderAgentPlayground();

      const retry = await screen.findByRole('button', { name: 'Retry version history' });
      expect(screen.queryByPlaceholderText('Enter your message...')).toBeNull();
      shouldFail = false;
      fireEvent.click(retry);

      expect(await screen.findByPlaceholderText('Enter your message...')).not.toBeNull();
      expect(screen.queryByText('Agent versions could not be loaded. Retry before running.')).toBeNull();
    });
  });
});
