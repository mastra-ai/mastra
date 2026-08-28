import type { LightSpanRecord } from '@mastra/core/storage';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { EnrichedThread } from '../enriched-thread';
import { TestLinkProvider } from '@/test/link-provider';

vi.mock('../trace-investigate', () => ({
  TraceInvestigate: ({ traceId }: { traceId: string }) => <div data-testid="trace-investigate">{traceId}</div>,
}));

// Scores are fetched per trace; this file only cares about the turn layout.
vi.mock('../trace-scores-collapsible', () => ({
  TraceScoresCollapsible: () => null,
}));

const trace = (traceId: string) => ({ traceId }) as LightSpanRecord;

const renderThread = (traces: LightSpanRecord[]) =>
  render(
    <TestLinkProvider>
      <EnrichedThread traces={traces} />
    </TestLinkProvider>,
  );

describe('EnrichedThread', () => {
  it('renders one turn per trace, in the order it was given', () => {
    renderThread([trace('trace-a'), trace('trace-b')]);

    expect(screen.getAllByTestId('trace-investigate').map(el => el.textContent)).toEqual(['trace-a', 'trace-b']);
  });

  it('renders nothing but its container when the thread has no traces', () => {
    renderThread([]);

    expect(screen.getByTestId('enriched-thread').childElementCount).toBe(0);
  });

  it('offers each turn its trace, in a new tab', () => {
    renderThread([trace('abcdef0123456789')]);

    // The full id is unreadable in a conversation, so the link wears a short one.
    const link = screen.getByRole('link', { name: /Trace #abcdef01/ });
    expect(link.getAttribute('href')).toBe('/traces?traceId=abcdef0123456789');
    expect(link.getAttribute('target')).toBe('_blank');
  });
});
