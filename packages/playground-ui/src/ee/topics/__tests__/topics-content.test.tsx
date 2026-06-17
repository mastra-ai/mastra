// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Topic } from '../types';

import { TopicSubtopicPanel, TopicsContent, TopicsLayout, TopicsSidebar } from '../components';
import { aggregateTopics } from '../utils';

const topics: Topic[] = [
  {
    id: 'support',
    name: 'Support',
    description: 'Support requests',
    subtopics: [
      {
        id: 'refunds',
        name: 'Refunds',
        description: 'Refund-related traces',
        traceSummaries: [
          { id: 'trace-1', name: 'Refund request', status: 'success', startedAt: '2026-06-15T10:00:00.000Z', durationMs: 250 },
          { id: 'trace-2', name: 'Refund failed', status: 'error', startedAt: '2026-06-15T11:00:00.000Z', durationMs: 50 },
        ],
      },
    ],
  },
];

vi.mock('react-resizable-panels', () => ({
  Group: ({ children }: { children: ReactNode }) => <div data-testid="panel-group">{children}</div>,
  Panel: ({ children }: { children: ReactNode }) => <div data-testid="panel">{children}</div>,
  usePanelRef: () => ({ current: { expand: vi.fn() } }),
  Separator: ({ children }: { children?: ReactNode }) => <div data-testid="panel-separator">{children}</div>,
}));

afterEach(() => cleanup());

describe('TopicsContent', () => {
  it('renders topic counts and opens subtopic details', () => {
    render(<TopicsContent topics={topics} />);

    expect(screen.getByRole('heading', { name: 'Topics' })).not.toBeNull();
    expect(screen.getByText('Support')).not.toBeNull();
    expect(screen.getAllByText('2 traces')).toHaveLength(2);
    expect(screen.getByText(/Group related traces into topics/)).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Refunds/ }));

    expect(screen.getByRole('heading', { name: 'Refunds' })).not.toBeNull();
    expect(screen.getByText('Refund-related traces')).not.toBeNull();
    expect(screen.getAllByText('2 traces').length).toBeGreaterThan(0);
    expect(screen.getByText('100% of topic traces')).not.toBeNull();
    expect(screen.getByRole('button', { name: /Refund request/ })).not.toBeNull();
  });

  it('filters trace summaries inside the selected subtopic', async () => {
    render(<TopicsContent topics={topics} selectedSubtopicId="refunds" />);

    const list = screen.getByRole('region', { name: 'Topic trace summaries' });
    fireEvent.change(within(list).getByPlaceholderText('Search traces'), { target: { value: 'failed' } });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Refund failed/ })).not.toBeNull();
      expect(screen.queryByRole('button', { name: /Refund request/ })).toBeNull();
    });
  });
});

describe('TopicsLayout', () => {
  it('renders sidebar, main content, and optional trace panel slots', () => {
    render(
      <TopicsLayout sidebar={<div>Topic tree</div>} tracePanel={<aside>Trace details</aside>}>
        <section>Subtopic details</section>
      </TopicsLayout>,
    );

    expect(screen.getByText('Topic tree')).not.toBeNull();
    expect(screen.getByText('Subtopic details')).not.toBeNull();
    expect(screen.getByText('Trace details')).not.toBeNull();
    expect(screen.getByTestId('panel-group')).not.toBeNull();
  });

  it('renders a trace panel without main content for direct trace routes', () => {
    render(<TopicsLayout sidebar={<div>Topic tree</div>} tracePanel={<aside>Trace details</aside>} />);

    expect(screen.getByText('Topic tree')).not.toBeNull();
    expect(screen.getByText('Trace details')).not.toBeNull();
    expect(screen.getByTestId('panel-group')).not.toBeNull();
  });
});

describe('TopicsSidebar and TopicSubtopicPanel', () => {
  it('notifies when selecting and closing a subtopic and trace', () => {
    const onSubtopicSelect = vi.fn();
    const onSubtopicClose = vi.fn();
    const onTraceSelect = vi.fn();
    const aggregatedTopics = aggregateTopics(topics);
    const subtopic = aggregatedTopics[0].subtopics[0];

    render(
      <>
        <TopicsSidebar topics={aggregatedTopics} onSubtopicSelect={onSubtopicSelect} />
        <TopicSubtopicPanel
          subtopic={subtopic}
          selectedTraceId="trace-1"
          onSubtopicClose={onSubtopicClose}
          onTraceSelect={onTraceSelect}
        />
      </>,
    );

    fireEvent.click(screen.getByRole('button', { name: /Refunds/ }));
    fireEvent.click(screen.getByRole('button', { name: /Refund request/ }));

    expect(onSubtopicSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'refunds', traceCount: 2 }));
    expect(onTraceSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'trace-1' }));

    fireEvent.click(screen.getByRole('button', { name: 'Close subtopic' }));
    expect(onSubtopicClose).toHaveBeenCalledOnce();
  });
});
