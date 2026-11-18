// @vitest-environment jsdom
import '@/test/inert-resize-observer';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RecordedToolCard } from '../recorded-tool-card';
import type { RecordedToolCardProps } from '../recorded-tool-card';
import { recordRequests } from '@/test/record-requests';

/*
 * A tool call read back from a record (a trace, a stored thread), drawn with no Mastra client, no React
 * Query and no Studio provider: everything it shows comes from what the call recorded.
 */

const recordedCall = (call: Partial<RecordedToolCardProps>): RecordedToolCardProps => ({
  toolName: 'searchHotels',
  toolCallId: 'call-1',
  input: { city: 'Paris' },
  output: { hotels: ['Left Bank'] },
  state: 'output-available',
  ...call,
});

/** Opens a card on its body: its first button is its header. */
const expand = (testId: string) => {
  const [header] = within(screen.getByTestId(testId)).getAllByRole('button');
  if (header) fireEvent.click(header);
};

describe('RecordedToolCard', () => {
  describe('when the call is a plain tool', () => {
    it('opens on the input and the result the call recorded', () => {
      render(<RecordedToolCard {...recordedCall({})} />);

      expand('tool-badge');

      expect(screen.getByText(/Left Bank/)).toBeTruthy();
    });
  });

  describe('when the call delegated to a sub-agent', () => {
    it('shows the answer the sub-agent gave', () => {
      render(
        <RecordedToolCard
          {...recordedCall({ toolName: 'agent-weatherAgent', output: { text: 'Sunny all weekend.' } })}
        />,
      );

      expand('agent-badge');

      expect(screen.getByText('Sunny all weekend.')).toBeTruthy();
    });

    it('draws the tools the sub-agent called, from their recorded results', () => {
      render(
        <RecordedToolCard
          {...recordedCall({
            toolName: 'agent-weatherAgent',
            output: {
              text: 'Sunny all weekend.',
              subAgentToolResults: [
                { toolName: 'forecast', toolCallId: 'sub-call-1', args: { city: 'Paris' }, result: { sky: 'clear' } },
              ],
            },
          })}
        />,
      );

      expand('agent-badge');
      expand('tool-badge');

      expect(screen.getByText(/clear/)).toBeTruthy();
    });

    it('asks the network for nothing, even when the sub-agent kept its messages in memory', () => {
      const requests = recordRequests();
      render(
        <RecordedToolCard
          {...recordedCall({ toolName: 'agent-weatherAgent', output: { subAgentThreadId: 'sub-thread' } })}
        />,
      );

      expect(screen.getByTestId('agent-badge')).toBeTruthy();
      expect(requests).toEqual([]);
    });
  });

  describe('when the call ran a workflow', () => {
    it('names the workflow and opens on the result it recorded', () => {
      render(
        <RecordedToolCard
          {...recordedCall({ toolName: 'workflow-tripPlanner', output: { runId: 'run-1', result: { days: 2 } } })}
        />,
      );

      expect(screen.getByText(/tripPlanner/i)).toBeTruthy();
      expand('tool-badge');
      expect(screen.getByText(/days/)).toBeTruthy();
    });

    it('asks the network for nothing', () => {
      const requests = recordRequests();
      render(<RecordedToolCard {...recordedCall({ toolName: 'workflow-tripPlanner', output: { runId: 'run-1' } })} />);

      expand('tool-badge');

      expect(requests).toEqual([]);
    });
  });

  describe('when the call submitted a plan', () => {
    it('shows the plan its output holds', () => {
      render(
        <RecordedToolCard
          {...recordedCall({
            toolName: 'submit_plan',
            output: {
              submittedPlan: { title: 'Weekend in Paris', plan: '# Weekend in Paris\n\n- Louvre', action: 'approved' },
            },
          })}
        />,
      );

      expect(screen.getByText('Weekend in Paris')).toBeTruthy();
    });
  });

  describe('when the call is one the transcript never draws', () => {
    it('draws nothing', () => {
      const { container } = render(<RecordedToolCard {...recordedCall({ toolName: 'updateWorkingMemory' })} />);

      expect(container.textContent).toBe('');
    });
  });
});
