import type { MastraDBMessage } from '@mastra/core/agent-controller';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../../../../e2e/ui/render';
import type { TimelineEntry } from '../../services/transcript';
import { initialTranscript, transcriptReducer } from '../../services/transcript';
import { TranscriptEntries } from '../Transcript';

const CREATED_AT = new Date('2026-07-15T10:00:00.000Z');

// ---------------------------------------------------------------------------
// Helpers — build DB messages the way the real pipeline does
// ---------------------------------------------------------------------------

/** A `role: 'signal'` message with `signal.type = 'user'` — the shape dispatchers produce. */
function userSignalDBMessage(id: string, text: string): MastraDBMessage {
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
          type: 'user',
          tagName: 'user',
          createdAt: CREATED_AT.toISOString(),
        },
      },
    },
  };
}

function notificationSignalDBMessage(id: string, text: string): MastraDBMessage {
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
          type: 'notification',
          tagName: 'notification',
          createdAt: CREATED_AT.toISOString(),
          attributes: { source: 'factory' },
        },
      },
    },
  };
}

/** Feed a DB message through the reducer to get a coerced TimelineEntry. */
function entryViaReducer(message: MastraDBMessage): TimelineEntry {
  const state = transcriptReducer(initialTranscript, {
    type: 'mergeWindow',
    messages: [message],
  });
  return state.entries[0]!;
}

/** Build a pre-coerced user message entry (simpler, for most tests). */
function userMessageEntry(id: string, text: string): TimelineEntry {
  return {
    kind: 'message',
    id,
    message: {
      id,
      role: 'user',
      createdAt: CREATED_AT,
      content: { format: 2, parts: [{ type: 'text', text }] },
    },
  };
}

function renderEntries(entries: TimelineEntry[]) {
  return renderWithProviders(<TranscriptEntries entries={entries} onApprove={() => {}} onRespond={() => {}} />);
}

// ---------------------------------------------------------------------------
// Skill envelope fixtures
// ---------------------------------------------------------------------------

const SKILL_BODY = '## Overview\n\nInvestigate the issue.\n\n## References\n- references/colors.md';
const SKILL_ENVELOPE = `<skill name="understand-issue">\n${SKILL_BODY}\n</skill>`;

const SKILL_WITH_ARGS =
  '<skill name="triage-issue">\nLook at the issue.\n\nARGUMENTS: https://github.com/org/repo/issues/42\n</skill>';

const SKILL_WITH_ESCAPED_BOUNDARY = '<skill name="test-skill">\nDo not use &lt;/skill&gt; as a closing tag.\n</skill>';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TranscriptEntries skill rows', () => {
  it('renders a skill activation as a collapsible row, not a chat bubble', async () => {
    renderEntries([userMessageEntry('msg-1', SKILL_ENVELOPE)]);

    const row = screen.getByRole('group', { name: 'Skill: understand-issue' });
    expect(row).toBeInTheDocument();
    expect(row).toHaveAttribute('data-skill-name', 'understand-issue');

    // The raw envelope XML must not leak into the document.
    expect(screen.queryByText(/<skill name=/)).not.toBeInTheDocument();

    // Collapsed: the body text should be hidden.
    expect(screen.queryByText(/Investigate the issue/)).not.toBeInTheDocument();
  });

  it('expands to show rendered markdown (headings, not literal ##)', async () => {
    renderEntries([userMessageEntry('msg-1', SKILL_ENVELOPE)]);

    await userEvent.click(screen.getByRole('button', { name: /Skill/ }));

    // After expanding, the markdown body should be visible and rendered as HTML.
    expect(screen.getByText(/Investigate the issue/)).toBeInTheDocument();
    // A `## References` heading should be rendered as an actual heading, not literal text.
    // The Markdown component renders headings as h2 elements.
    const row = screen.getByRole('group', { name: 'Skill: understand-issue' });
    const headings = within(row).getAllByRole('heading');
    expect(headings.length).toBeGreaterThan(0);
  });

  it('shows ARGUMENTS in the collapsed header preview', () => {
    renderEntries([userMessageEntry('msg-1', SKILL_WITH_ARGS)]);

    // The arguments preview should be visible in the collapsed header.
    expect(screen.getByText(/github\.com\/org\/repo\/issues\/42/)).toBeInTheDocument();
  });

  it('strips ARGUMENTS from the expanded instruction body', async () => {
    renderEntries([userMessageEntry('msg-1', SKILL_WITH_ARGS)]);

    await userEvent.click(screen.getByRole('button', { name: /Skill/ }));

    // The body should contain the instructions but not the raw ARGUMENTS marker.
    expect(screen.getByText(/Look at the issue/)).toBeInTheDocument();
    // The ARGUMENTS text should only appear once (in the header preview).
    const matches = screen.getAllByText(/github\.com\/org\/repo\/issues\/42/);
    expect(matches).toHaveLength(1);
  });

  it('unescapes the boundary sentinel in the expanded body', async () => {
    renderEntries([userMessageEntry('msg-1', SKILL_WITH_ESCAPED_BOUNDARY)]);

    await userEvent.click(screen.getByRole('button', { name: /Skill/ }));

    // The escaped sentinel should be rendered as the literal `</skill>` text.
    expect(screen.getByText(/Do not use <\/skill> as a closing tag/)).toBeInTheDocument();
    // The raw escaped form should not appear.
    expect(screen.queryByText(/&lt;\/skill&gt;/)).not.toBeInTheDocument();
  });

  it('renders a kickoff with the appended work-item feed as a skill row plus a feed row', async () => {
    const feed = '[Ada · 2026-08-28T10:00:00.000Z]\nLooks off to me';
    renderEntries([userMessageEntry('msg-1', `${SKILL_WITH_ARGS}\n\n<work-item-feed>\n${feed}\n</work-item-feed>`)]);

    expect(screen.getByRole('group', { name: 'Skill: triage-issue' })).toBeInTheDocument();
    const feedRow = screen.getByRole('group', { name: 'Signal: Work item feed' });

    await userEvent.click(within(feedRow).getByRole('button'));
    expect(within(feedRow).getByText(/Looks off to me/, { selector: 'p' })).toBeInTheDocument();

    // Neither envelope leaks as raw text.
    expect(screen.queryByText(/<skill name=/)).not.toBeInTheDocument();
    expect(screen.queryByText(/<work-item-feed>/)).not.toBeInTheDocument();
  });

  it('renders the agent activating a skill itself as the same row, not a raw tool card', async () => {
    renderEntries([
      {
        kind: 'message',
        id: 'msg-tool',
        message: {
          id: 'msg-tool',
          role: 'assistant',
          createdAt: CREATED_AT,
          content: {
            format: 2,
            parts: [
              {
                type: 'tool-invocation',
                toolInvocation: {
                  state: 'result',
                  toolCallId: 'call-1',
                  toolName: 'skill',
                  args: { name: 'understand-issue' },
                  result: SKILL_BODY,
                },
              },
            ],
          },
        },
      },
    ]);

    const row = screen.getByRole('group', { name: 'Skill: understand-issue' });
    expect(within(row).queryByText(/"name"/)).not.toBeInTheDocument();

    await userEvent.click(within(row).getByRole('button'));
    expect(within(row).getByText(/Investigate the issue/)).toBeInTheDocument();
  });

  it('draws nothing for a message whose only part is a step marker', () => {
    renderEntries([
      {
        kind: 'message',
        id: 'msg-step',
        message: {
          id: 'msg-step',
          role: 'user',
          createdAt: CREATED_AT,
          content: { format: 2, parts: [{ type: 'step-start' }] },
        },
      },
    ]);

    expect(document.querySelector('[data-message-id="msg-step"]')).toBeEmptyDOMElement();
  });

  it('renders an ordinary user text message as a right-aligned chat bubble', () => {
    renderEntries([userMessageEntry('msg-plain', 'Hello, can you help me?')]);

    // The text should be visible.
    expect(screen.getByText('Hello, can you help me?')).toBeInTheDocument();
    // There should be no skill row.
    expect(screen.queryByRole('group', { name: /^Skill:/ })).not.toBeInTheDocument();
  });

  it('coerces role: signal with type: user through the reducer and renders skill row', () => {
    const entry = entryViaReducer(userSignalDBMessage('sig-skill', SKILL_ENVELOPE));
    renderEntries([entry]);

    // The reducer should have coerced role to 'user'.
    expect(entry.kind).toBe('message');
    if (entry.kind === 'message') {
      expect(entry.message.role).toBe('user');
    }

    // The skill row should render correctly.
    expect(screen.getByRole('group', { name: 'Skill: understand-issue' })).toBeInTheDocument();
  });

  it('suppresses a notification signal that echoes a skill envelope', () => {
    renderEntries([
      entryViaReducer(userSignalDBMessage('sig-skill', SKILL_ENVELOPE)),
      entryViaReducer(notificationSignalDBMessage('sig-notification', SKILL_ENVELOPE)),
    ]);

    expect(screen.getByRole('group', { name: 'Skill: understand-issue' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Notification: factory' })).not.toBeInTheDocument();
    expect(screen.queryByText(/<skill name=/)).not.toBeInTheDocument();
  });
});
