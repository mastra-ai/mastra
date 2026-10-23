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
  });
});
