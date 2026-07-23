import type { MastraDBMessage } from '@mastra/core/agent-controller';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../../../../../e2e/web-ui/render';
import type { TimelineEntry } from '../../services/transcript';
import { TranscriptEntries } from '../Transcript';

const CREATED_AT = new Date('2026-07-15T10:00:00.000Z');

function signalDBMessage({
  id,
  type,
  tagName,
  text,
  attributes,
  metadata,
}: {
  id: string;
  type: string;
  tagName: string;
  text: string;
  attributes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}): MastraDBMessage {
  return {
    id,
    role: 'signal',
    createdAt: CREATED_AT,
    content: {
      format: 2,
      parts: [{ type: 'text', text }],
      metadata: {
        signal: {
          id,
          type,
          tagName,
          createdAt: CREATED_AT.toISOString(),
          ...(attributes ? { attributes } : {}),
          ...(metadata ? { metadata } : {}),
        },
      },
    },
  };
}

function stateSignalEntry(id: string, stateId: string, mode: 'snapshot' | 'delta', text: string): TimelineEntry {
  return {
    kind: 'message',
    id,
    message: signalDBMessage({
      id,
      type: 'state',
      tagName: stateId,
      text,
      metadata: { state: { id: stateId, mode, version: 3 } },
    }),
  };
}

function reactiveSignalEntry(id: string, tagName: string, text: string): TimelineEntry {
  return { kind: 'message', id, message: signalDBMessage({ id, type: 'reactive', tagName, text }) };
}

function renderEntries(entries: TimelineEntry[]) {
  return renderWithProviders(
    <TranscriptEntries entries={entries} onApprove={() => {}} onRespond={() => {}} />,
  );
}

const FACTORY_TEXT =
  'Factory phase update:\nWork item: blossom-spandex moved to review. ' +
  'Use factory_transition_work_item with expectedRevision 4 to advance.';

describe('TranscriptEntries signal rows', () => {
  it('renders a state delta signal as a collapsible row instead of raw markdown', async () => {
    renderEntries([stateSignalEntry('sig-1', 'factory-phase', 'delta', FACTORY_TEXT)]);

    const row = screen.getByRole('group', { name: 'Signal: State delta: factory-phase' });
    expect(row).toBeInTheDocument();
    expect(row).toHaveAttribute('data-signal-kind', 'state');
    // Collapsed: only the truncated preview is shown; the tail of the raw
    // contents (beyond the 72-char preview) must not be rendered.
    expect(screen.queryByText(/expectedRevision 4/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /State delta: factory-phase/ }));
    expect(screen.getByText(/expectedRevision 4 to advance/)).toBeInTheDocument();
  });

  it('labels state snapshots distinctly from deltas', () => {
    renderEntries([stateSignalEntry('sig-1', 'browser', 'snapshot', 'Browser state contents')]);

    expect(screen.getByRole('group', { name: 'Signal: State snapshot: browser' })).toBeInTheDocument();
  });

  it('suppresses tasks and goal state snapshots entirely', () => {
    renderEntries([
      stateSignalEntry('sig-tasks', 'tasks', 'snapshot', '<current-task-list>...</current-task-list>'),
      stateSignalEntry('sig-goal', 'goal', 'snapshot', '<current-objective>...</current-objective>'),
    ]);

    expect(screen.queryByRole('group')).not.toBeInTheDocument();
    expect(screen.queryByText(/current-task-list/)).not.toBeInTheDocument();
    expect(screen.queryByText(/current-objective/)).not.toBeInTheDocument();
  });

  it('hides internal github reactive signals but renders other reactive tags', () => {
    renderEntries([
      reactiveSignalEntry('sig-gh', 'github-subscribe-pr', 'subscribed to PR #1'),
      reactiveSignalEntry('sig-build', 'build-status', 'Build finished: success'),
    ]);

    expect(screen.queryByText(/subscribed to PR/)).not.toBeInTheDocument();
    const row = screen.getByRole('group', { name: 'Signal: build-status' });
    expect(row).toHaveAttribute('data-signal-kind', 'reactive');
  });

  it('renders system reminders with a dedicated label', () => {
    renderEntries([reactiveSignalEntry('sig-reminder', 'system-reminder', 'Remember to run the tests.')]);

    const row = screen.getByRole('group', { name: 'Signal: System reminder' });
    expect(row).toHaveAttribute('data-signal-kind', 'reminder');
  });

  it('keeps rendering persisted notification signals as notification rows', () => {
    const entry: TimelineEntry = {
      kind: 'message',
      id: 'sig-notif',
      message: signalDBMessage({
        id: 'sig-notif',
        type: 'notification',
        tagName: 'notification',
        text: 'PR #7 was merged',
        attributes: { notificationId: 'n-1', source: 'github', kind: 'pr-merged', priority: 'medium' },
      }),
    };

    renderEntries([entry]);

    expect(screen.getByRole('group', { name: 'Notification: github' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /^Signal:/ })).not.toBeInTheDocument();
  });
});
