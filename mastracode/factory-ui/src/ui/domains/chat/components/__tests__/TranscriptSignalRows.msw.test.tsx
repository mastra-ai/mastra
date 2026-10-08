import type { MastraDBMessage } from '@mastra/core/agent-controller';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../../../../e2e/ui/render';
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

function streamedReactiveSignalEntry(id: string, tagName: string, text: string): TimelineEntry {
  const signal = {
    id,
    type: 'reactive',
    tagName,
    contents: text,
    createdAt: CREATED_AT.toISOString(),
  };
  return {
    kind: 'message',
    id,
    message: {
      id,
      role: 'signal',
      createdAt: CREATED_AT,
      content: {
        format: 2,
        parts: [{ type: 'data-signal', data: signal }],
        metadata: { signal },
      },
    },
  };
}

function renderEntries(entries: TimelineEntry[]) {
  return renderWithProviders(<TranscriptEntries entries={entries} onApprove={() => {}} onRespond={() => {}} />);
}

const FACTORY_TEXT =
  'Factory phase update:\nWork item: blossom-spandex moved to review. ' +
  'Use factory_transition_work_item with expectedRevision 4 to advance.';

describe('TranscriptEntries signal rows', () => {
  it('renders a state delta signal as a collapsible row instead of raw markdown', async () => {
    renderEntries([stateSignalEntry('sig-1', 'factory-phase', 'delta', FACTORY_TEXT)]);

    const row = screen.getByRole('group', { name: 'Signal: factory-phase' });
    expect(within(row).getByText('delta')).toBeVisible();
    expect(row).toHaveAttribute('data-signal-kind', 'state');
    // Collapsed: only the truncated preview is shown; the tail of the raw
    // contents (beyond the 72-char preview) must not be rendered.
    expect(screen.queryByText(/expectedRevision 4/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /factory-phase/ }));
    expect(screen.getByText(/expectedRevision 4 to advance/)).toBeInTheDocument();
  });

  it('labels state snapshots distinctly from deltas', () => {
    renderEntries([stateSignalEntry('sig-1', 'browser', 'snapshot', 'Browser state contents')]);

    const row = screen.getByRole('group', { name: 'Signal: browser' });
    expect(within(row).getByText('snapshot')).toBeVisible();
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

  it('links reminder sources to the knowledge flyout', async () => {
    const entry: TimelineEntry = {
      kind: 'message',
      id: 'sig-rem',
      message: signalDBMessage({
        id: 'sig-rem',
        type: 'reactive',
        tagName: 'remembered',
        text: 'Atlas launches in March.\n\nSources: rec-1',
        attributes: {
          sourceIds: 'rec-1',
          sourceNodes: JSON.stringify([{ nodeId: 'node-1', name: 'Project Atlas', recordId: 'rec-1' }]),
        },
      }),
    };
    const router = createMemoryRouter(
      [
        {
          path: '/factories/:factoryId/user/threads/:threadId',
          element: <TranscriptEntries entries={[entry]} onApprove={() => {}} onRespond={() => {}} />,
        },
        { path: '/factories/:factoryId/knowledge', element: <p>knowledge page</p> },
      ],
      { initialEntries: ['/factories/f-1/user/threads/t-1'] },
    );
    renderWithProviders(<RouterProvider router={router} />);

    const chip = within(screen.getByRole('navigation', { name: 'Signal sources' })).getByRole('link', {
      name: 'Project Atlas',
    });
    expect(chip).toHaveAttribute('href', '/factories/f-1/knowledge?node=node-1&record=rec-1');
    chip.focus();
    await userEvent.keyboard('{Enter}');
    expect(await screen.findByText('knowledge page')).toBeInTheDocument();
  });

  it.each([undefined, 'not json', '[{"name":"no id"}]'])(
    'renders reminders without usable sourceNodes as plain rows: %s',
    sourceNodes => {
      renderEntries([
        {
          kind: 'message',
          id: 'sig-old',
          message: signalDBMessage({
            id: 'sig-old',
            type: 'reactive',
            tagName: 'remembered',
            text: 'Atlas launches in March.\n\nSources: rec-1',
            attributes: { sourceIds: 'rec-1', ...(sourceNodes ? { sourceNodes } : {}) },
          }),
        },
      ]);

      expect(screen.getByRole('group', { name: 'Signal: remembered' })).toBeInTheDocument();
      expect(screen.queryByRole('navigation', { name: 'Signal sources' })).not.toBeInTheDocument();
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    },
  );

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

  it('renders the contents of a live system reminder data part on its line', () => {
    renderEntries([
      streamedReactiveSignalEntry('sig-reminder', 'system-reminder', 'Remember to run the focused tests.'),
    ]);

    const row = screen.getByRole('group', { name: 'Signal: System reminder' });
    expect(row).toHaveTextContent('Remember to run the focused tests.');
    expect(within(row).queryByRole('button')).not.toBeInTheDocument();
  });

  it('folds a reminder its line cannot hold', async () => {
    const reminder =
      'Remember to run the focused tests before submitting, and keep every change scoped to the package you touched.';
    renderEntries([streamedReactiveSignalEntry('sig-reminder', 'system-reminder', reminder)]);

    await userEvent.click(screen.getByRole('button', { name: /System reminder/ }));

    expect(screen.getByText(reminder)).toBeVisible();
  });

  it('renders a content-less system reminder without an empty disclosure', () => {
    renderEntries([reactiveSignalEntry('sig-reminder', 'system-reminder', '')]);

    const row = screen.getByRole('group', { name: 'Signal: System reminder' });
    expect(row).toHaveTextContent('System reminder');
    expect(within(row).queryByRole('button')).not.toBeInTheDocument();
  });

  it('marks a temporal gap as a separator and keeps the stamp out of the line', () => {
    renderEntries([
      {
        kind: 'message',
        id: 'sig-gap',
        message: signalDBMessage({
          id: 'sig-gap',
          type: 'reactive',
          tagName: 'system-reminder',
          text: '1 hour 58 minutes later — 08/11/2026, 5:21 PM GMT+2',
          attributes: { type: 'temporal-gap' },
        }),
      },
    ]);

    const gap = screen.getByRole('separator');
    expect(gap).toHaveTextContent('1 hour 58 minutes later');
    expect(gap).not.toHaveTextContent('5:21 PM');
    expect(screen.queryByRole('group', { name: 'Signal: System reminder' })).not.toBeInTheDocument();
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
