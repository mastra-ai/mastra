// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TracesSpansSwitch } from '../traces-spans-switch';

afterEach(cleanup);

describe('TracesSpansSwitch', () => {
  describe('when the traces view is current', () => {
    it('marks the Traces tab as selected', () => {
      render(<TracesSpansSwitch current="traces" onViewChange={vi.fn()} />);

      expect(screen.getByRole('tab', { name: 'Traces' }).getAttribute('aria-selected')).toBe('true');
    });

    it('asks the host to switch to spans when the Spans tab is clicked', () => {
      const onViewChange = vi.fn();
      render(<TracesSpansSwitch current="traces" onViewChange={onViewChange} />);

      fireEvent.click(screen.getByRole('tab', { name: 'Spans' }));

      expect(onViewChange).toHaveBeenCalledWith('spans');
    });

    it('does not offer the threads view by default', () => {
      render(<TracesSpansSwitch current="traces" onViewChange={vi.fn()} />);

      expect(screen.queryByRole('tab', { name: 'Threads' })).toBeNull();
    });
  });

  describe('when the host offers the threads view', () => {
    it('renders the tabs in the given order', () => {
      render(<TracesSpansSwitch current="traces" views={['traces', 'spans', 'threads']} onViewChange={vi.fn()} />);

      expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual(['Traces', 'Spans', 'Threads']);
    });

    it('asks the host to switch to threads when the Threads tab is clicked', () => {
      const onViewChange = vi.fn();
      render(<TracesSpansSwitch current="traces" views={['traces', 'threads']} onViewChange={onViewChange} />);

      fireEvent.click(screen.getByRole('tab', { name: 'Threads' }));

      expect(onViewChange).toHaveBeenCalledWith('threads');
    });

    it('marks the Threads tab as selected when threads are current', () => {
      render(<TracesSpansSwitch current="threads" views={['traces', 'threads']} onViewChange={vi.fn()} />);

      expect(screen.getByRole('tab', { name: 'Threads' }).getAttribute('aria-selected')).toBe('true');
    });
  });

  describe('when the host offers only threads besides traces', () => {
    it('does not render the Spans tab', () => {
      render(<TracesSpansSwitch current="traces" views={['traces', 'threads']} onViewChange={vi.fn()} />);

      expect(screen.queryByRole('tab', { name: 'Spans' })).toBeNull();
    });
  });
});
