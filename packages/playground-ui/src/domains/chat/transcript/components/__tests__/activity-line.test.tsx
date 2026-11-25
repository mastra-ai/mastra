// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';

import { describe, expect, it } from 'vitest';
import type { TimelineEntry } from '../../services/transcript';
import { ActivityLine } from '../activity-line/activity-line';

function toolCall(id: string, state: 'call' | 'result'): TimelineEntry {
  return {
    kind: 'message',
    id,
    message: {
      id,
      role: 'assistant',
      createdAt: new Date('2026-07-15T10:00:00.000Z'),
      content: {
        format: 2,
        parts: [
          { type: 'tool-invocation', toolInvocation: { toolCallId: 't1', toolName: 'searchDocs', args: {}, state } },
        ],
      },
    },
  };
}

describe('ActivityLine', () => {
  it('shows the running tool while the run works', () => {
    render(<ActivityLine entries={[toolCall('a', 'call')]} busy runsStarted={1} stretchLive={false} />);
    expect(screen.getByText('Using SearchDocs')).toBeTruthy();
  });

  it('shows Thinking once the tool settles and the run is still busy', () => {
    render(<ActivityLine entries={[toolCall('a', 'result')]} busy runsStarted={1} stretchLive={false} />);
    expect(screen.getByText('Thinking')).toBeTruthy();
  });

  it('draws nothing for a run that was already over when it mounted', () => {
    const { container } = render(
      <ActivityLine entries={[toolCall('a', 'result')]} busy={false} runsStarted={1} stretchLive={false} />,
    );
    expect(container.textContent).toBe('');
  });

  it('stays quiet while the stretch line already speaks for the run', () => {
    const { container } = render(<ActivityLine entries={[toolCall('a', 'result')]} busy runsStarted={1} stretchLive />);
    expect(container.textContent).toBe('');
  });
});
