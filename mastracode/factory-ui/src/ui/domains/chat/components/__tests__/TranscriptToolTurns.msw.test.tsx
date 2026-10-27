import type { MastraDBMessage } from '@mastra/core/agent-controller';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../../../../e2e/ui/render';
import type { MessageEntry, TimelineEntry } from '../../services/transcript';
import { TranscriptEntries } from '../Transcript';

const createdAt = new Date('2026-10-27T10:00:00Z');
const noop = () => {};

function message(id: string, role: MastraDBMessage['role'], parts: MastraDBMessage['content']['parts']): MessageEntry {
  return { kind: 'message', id, message: { id, role, createdAt, content: { format: 2, parts } } };
}

const question = message('user-1', 'user', [{ type: 'text', text: 'Check the build' }]);
const nextQuestion = message('user-2', 'user', [{ type: 'text', text: 'Now check the tests' }]);
function toolMessage(id: string) {
  return message(
    id,
    'assistant',
    ['one.ts', 'two.ts', 'three.ts'].map((path, index) => ({
      type: 'tool-invocation',
      toolInvocation: { state: 'result', toolCallId: `${id}-${index}`, toolName: 'view', args: { path }, result: 'ok' },
    })),
  );
}
const tools = toolMessage('tools');
const answer = message('answer', 'assistant', [{ type: 'text', text: 'The build passes.' }]);

function Transcript({ entries, running = false }: { entries: TimelineEntry[]; running?: boolean }) {
  return (
    <MemoryRouter>
      <TranscriptEntries entries={entries} running={running} onApprove={noop} onRespond={noop} />
    </MemoryRouter>
  );
}

describe('Transcript tool updates', () => {
  // FACT-523: finishing a tool or assistant step is not the boundary; the next user turn is.
  it('keeps updates visible through the reply, then folds them when the next turn starts', async () => {
    const entries = [question, tools];
    const { rerender } = renderWithProviders(<Transcript entries={entries} running />);
    expect(screen.getAllByRole('group', { name: 'Tool: view' })).toHaveLength(3);
    expect(screen.queryByRole('group', { name: /Tool group/ })).not.toBeInTheDocument();

    rerender(<Transcript entries={[...entries, answer]} />);
    expect(screen.getAllByRole('group', { name: 'Tool: view' })).toHaveLength(3);
    expect(screen.getByText('The build passes.')).toBeVisible();

    rerender(<Transcript entries={[...entries, answer, nextQuestion]} running />);
    const group = screen.getByRole('group', { name: 'Tool group: 3 steps' });
    expect(screen.queryByRole('group', { name: 'Tool: view' })).not.toBeInTheDocument();
    expect(screen.getByText('The build passes.')).toBeVisible();

    await userEvent.click(within(group).getByRole('button'));
    expect(screen.getAllByRole('group', { name: 'Tool: view' })).toHaveLength(3);

    rerender(
      <Transcript
        entries={[
          ...entries,
          answer,
          nextQuestion,
          message('next-answer', 'assistant', [{ type: 'text', text: 'Checking the tests…' }]),
        ]}
        running
      />,
    );
    expect(screen.getAllByRole('group', { name: 'Tool: view' })).toHaveLength(3);
  });

  it('folds restored earlier turns while keeping the latest turn visible', () => {
    const latestTools = toolMessage('latest-tools');
    renderWithProviders(<Transcript entries={[question, tools, answer, nextQuestion, latestTools]} />);
    expect(screen.getAllByRole('group', { name: /Tool group/ })).toHaveLength(1);
    expect(screen.getAllByRole('group', { name: 'Tool: view' })).toHaveLength(3);
    expect(screen.getByText('The build passes.')).toBeVisible();
  });
});
