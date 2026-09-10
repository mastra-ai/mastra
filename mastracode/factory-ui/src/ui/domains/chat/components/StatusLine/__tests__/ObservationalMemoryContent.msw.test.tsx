import type { AgentControllerOMProgress, AgentControllerOMRecord } from '@mastra/client-js';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../../e2e/ui/render';
import { ChatRuntimeContext } from '../../../context/ChatRuntimeContext';
import { ChatSessionTestProvider } from '../../../context/ChatSessionTestProvider';
import { FACTORY_ID, SESSION_ID, stubPreparingSession } from '../../__tests__/composer-session-test-fixture';
import { OperationalMemoryStatus } from '../OperationalMemoryStatus';

const API = `${TEST_BASE_URL}/api/agent-controller/code`;

const omProgress: AgentControllerOMProgress = {
  status: 'idle',
  pendingTokens: 14_900,
  threshold: 30_000,
  thresholdPercent: 49.7,
  observationTokens: 12_000,
  reflectionThreshold: 40_000,
  reflectionThresholdPercent: 30,
  projectedMessageRemoval: 0,
  projectedReflectionSavings: 0,
};

function buildRecord(overrides: Partial<AgentControllerOMRecord> = {}): AgentControllerOMRecord {
  return {
    id: 'record-1',
    scope: 'thread',
    resourceId: 'resource-1',
    threadId: SESSION_ID,
    activeObservations: '',
    originType: 'observation',
    generationCount: 1,
    totalTokensObserved: 100,
    observationTokenCount: 40,
    pendingMessageTokens: 0,
    isObserving: false,
    isReflecting: false,
    config: {},
    createdAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
    updatedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
    ...overrides,
  } as AgentControllerOMRecord;
}

function stubOMSession({
  record,
  onRead,
}: {
  record?: AgentControllerOMRecord;
  onRead?: () => void;
} = {}) {
  const session = stubPreparingSession({ materialized: true });
  session.finishWorkspace();
  server.use(
    http.get(`${API}/sessions/:resourceId/om`, () => {
      onRead?.();
      return HttpResponse.json({ record });
    }),
  );
  return session;
}

function renderStatus({ bufferingObservations = false }: { bufferingObservations?: boolean } = {}) {
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/factories/${FACTORY_ID}/user/threads/${SESSION_ID}`]}>
      <Routes>
        <Route
          path="/factories/:factoryId/user/threads/:threadId"
          element={
            <ChatSessionTestProvider threadId={SESSION_ID} userScoped deferUntilMessagesReady={false}>
              <ChatRuntimeContext.Provider
                value={{
                  followUpCount: 0,
                  omProgress,
                  omPhase: 'idle',
                  bufferingMessages: false,
                  bufferingObservations,
                  tokensPerSec: 0,
                }}
              >
                <OperationalMemoryStatus />
              </ChatRuntimeContext.Provider>
            </ChatSessionTestProvider>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

async function openBudgets() {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: /^Memory budgets:/ }));
}

describe('observational memory content in the budget popover', () => {
  it('shows the retained observations alongside the budgets', async () => {
    stubOMSession({
      record: buildRecord({
        activeObservations:
          '<observations>\nDate: Jan 1, 2026\n* 🔴 (10:00) deploy blocked on migration\n</observations>',
      }),
    });

    renderStatus();
    await openBudgets();

    // the budgets still read
    expect(await screen.findByText('Read into memory once full')).toBeVisible();
    // and now the content behind them does too
    await waitFor(() => expect(screen.getByText(/deploy blocked on migration/)).toBeVisible());
  });

  it('separates content still pending from what is already committed', async () => {
    stubOMSession({
      record: buildRecord({
        activeObservations: '<observations>\nDate: Jan 1, 2026\n* 🔴 (10:00) committed detail\n</observations>',
        bufferedObservationChunks: [
          { cycleId: 'cycle-1', observations: 'chunk awaiting activation', tokenCount: 8, messageTokens: 16 },
        ],
        bufferedReflection: 'reflection awaiting commit',
      }),
    });

    renderStatus();
    await openBudgets();

    await waitFor(() => expect(screen.getByText(/committed detail/)).toBeVisible());
    expect(screen.getByText('Pending activation')).toBeVisible();
    expect(screen.getByText('chunk awaiting activation')).toBeVisible();
    expect(screen.getByText('Pending reflection')).toBeVisible();
    expect(screen.getByText('reflection awaiting commit')).toBeVisible();
  });

  it('says so plainly when nothing has been read into memory yet', async () => {
    stubOMSession({ record: undefined });

    renderStatus();
    await openBudgets();

    await waitFor(() =>
      expect(screen.getByText('Nothing has been read into memory for this conversation yet.')).toBeVisible(),
    );
  });

  it('does not read the record until the panel is opened', async () => {
    const onRead = vi.fn();
    stubOMSession({ record: buildRecord(), onRead });

    renderStatus();

    await screen.findByRole('button', { name: /^Memory budgets:/ });
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(onRead).not.toHaveBeenCalled();

    await openBudgets();
    await waitFor(() => expect(onRead).toHaveBeenCalled());
  });

  it('keeps the content in a bounded scrolling area', async () => {
    stubOMSession({ record: buildRecord({ activeObservations: 'a long observation log' }) });

    renderStatus();
    await openBudgets();

    const content = await screen.findByTestId('om-content');
    expect(content.className).toContain('overflow-y-auto');
    expect(content.className).toContain('max-h-80');
  });
});
