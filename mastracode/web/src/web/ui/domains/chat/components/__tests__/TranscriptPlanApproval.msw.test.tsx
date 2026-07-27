import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../../e2e/web-ui/render';
import { ChatSessionContext } from '../../context/ChatSessionContext';
import type { ChatSessionContextApi } from '../../context/ChatSessionContext';
import type { SuspensionPrompt, TimelineEntry } from '../../services/transcript';
import { TranscriptEntries } from '../Transcript';

const PLAN_URL = `${TEST_BASE_URL}/web/workspace/plan`;

const chatContext: ChatSessionContextApi = {
  resourceId: 'session-123',
  sessionEnabled: true,
  resourceEnabled: true,
  baseUrl: TEST_BASE_URL,
  kind: 'factory',
};

function planEntry(path: string): TimelineEntry {
  const prompt: SuspensionPrompt = {
    kind: 'suspension',
    id: 'suspension-call_submit_plan',
    toolCallId: 'call_submit_plan',
    toolName: 'submit_plan',
    args: { path },
    suspendPayload: { path },
  };
  return prompt;
}

function renderPlan(ui: ReactElement) {
  return renderWithProviders(<ChatSessionContext.Provider value={chatContext}>{ui}</ChatSessionContext.Provider>);
}

describe('TranscriptEntries submit_plan card', () => {
  it('fetches and renders the plan markdown content instead of only the path', async () => {
    let seenWorkspacePath: string | null = null;
    let seenPath: string | null = null;
    server.use(
      http.get(PLAN_URL, ({ request }) => {
        const url = new global.URL(request.url);
        seenWorkspacePath = url.searchParams.get('workspacePath');
        seenPath = url.searchParams.get('path');
        return HttpResponse.json({
          workspacePath: 'session-123',
          path: '.mastracode/plans/add-readme.md',
          name: 'add-readme.md',
          size: 24,
          updatedAt: '2026-07-15T00:00:00.000Z',
          contentType: 'text',
          content: '# Add a README\n\n- Draft the intro',
        });
      }),
    );

    renderPlan(
      <TranscriptEntries
        entries={[planEntry('.mastracode/plans/add-readme.md')]}
        onApprove={() => {}}
        onRespond={() => {}}
      />,
    );

    await waitFor(() => expect(screen.getByText('Add a README')).toBeInTheDocument());
    expect(seenWorkspacePath).toBe('session-123');
    expect(seenPath).toBe('.mastracode/plans/add-readme.md');
    expect(screen.getByText('Draft the intro')).toBeInTheDocument();
    // The approval controls remain available alongside the rendered plan.
    expect(screen.getByRole('button', { name: /Approve the plan/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reject the plan/ })).toBeInTheDocument();
  });

  it('shows an error state when the plan file cannot be read', async () => {
    server.use(http.get(PLAN_URL, () => HttpResponse.json({ error: 'not found' }, { status: 404 })));

    renderPlan(
      <TranscriptEntries
        entries={[planEntry('.mastracode/plans/missing.md')]}
        onApprove={() => {}}
        onRespond={() => {}}
      />,
    );

    await waitFor(() => expect(screen.getByText(/Unable to load the plan file/)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Approve the plan/ })).toBeInTheDocument();
  });
});
