// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ObservationDetailView } from '../observation-detail-view';
import { omHistoryRecords } from './fixtures/memory-studio';

Object.defineProperty(CSSStyleSheet.prototype, 'replaceSync', { value: () => {} });
Object.defineProperty(globalThis, 'PointerEvent', { value: MouseEvent });
Object.defineProperty(globalThis, 'ResizeObserver', {
  value: class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
});

afterEach(() => cleanup());

it('shows the previous and current observation when diff is enabled', async () => {
  render(<ObservationDetailView records={omHistoryRecords} selectedRecordId="om-2" onSelectRecord={vi.fn()} />);

  fireEvent.click(screen.getByRole('checkbox', { name: 'Show diff' }));

  await waitFor(() => {
    const content = screen.getByTestId('observation-detail-body').querySelector('diffs-container')
      ?.shadowRoot?.textContent;
    expect(content).toContain('User asked about onboarding');
    expect(content).toContain('User reported a blocking bug');
  });
}, 15_000);
