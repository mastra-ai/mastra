// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ThinkingLevelRamp } from './thinking-level-ramp';
import type { ThinkingLevelOption } from './use-thinking-level-stop';

type Level = 'off' | 'low' | 'medium' | 'high';

const LEVELS: ThinkingLevelOption<Level>[] = [
  { value: 'off', label: 'Off', emphasis: 'muted' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High', emphasis: 'warning' },
];

// The picked cell (Low) is wide enough for its name; the others are narrow.
const CELL_EDGES: [number, number][] = [
  [0, 20],
  [20, 90],
  [90, 110],
  [110, 130],
];

function renderRamp(value: Level | undefined, extra: { unavailableReason?: string } = {}) {
  const onChange = vi.fn();
  const { container } = render(
    <ThinkingLevelRamp options={LEVELS} value={value} label="Thinking" onChange={onChange} {...extra} />,
  );
  const cells = [...container.querySelectorAll<HTMLElement>('[data-stop]')];
  cells.forEach((cell, stop) => {
    const [left, right] = CELL_EDGES[stop] ?? [0, 0];
    cell.getBoundingClientRect = () => new DOMRect(left, 0, right - left, 32);
  });
  const track = cells[0]?.parentElement;
  if (!track) throw new Error('The ramp has no track');
  const findPill = () => container.querySelector<HTMLElement>('[data-pill]');
  const pill = () => {
    const found = findPill();
    if (!found) throw new Error('No pill is raised');
    return found;
  };
  return { onChange, track, findPill, pill, slider: screen.getByRole('slider', { name: 'Thinking' }) };
}

describe('ThinkingLevelRamp', () => {
  afterEach(cleanup);

  describe('when a level is picked', () => {
    it('raises a pill on that level and reports it to assistive tech', () => {
      const { findPill, slider } = renderRamp('low');

      expect(findPill()).not.toBeNull();
      expect(document.querySelector('[data-picked]')?.textContent).toBe('Low');
      expect(slider.getAttribute('aria-valuetext')).toBe('Low');
    });
  });

  describe('when a pointer clicks a level', () => {
    it('writes the level under the pointer, even beside the wide picked cell', () => {
      const { onChange, track } = renderRamp('low');

      fireEvent.pointerDown(track, { clientX: 100, button: 0 });
      fireEvent.pointerUp(track, { clientX: 100 });

      expect(onChange.mock.calls).toEqual([['medium']]);
    });

    it('does not write the level that is already picked', () => {
      const { onChange, track } = renderRamp('low');

      fireEvent.pointerDown(track, { clientX: 50, button: 0 });
      fireEvent.pointerUp(track, { clientX: 50 });

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('when a pointer drags across levels', () => {
    it('moves the pill along but writes only the level it ends on', () => {
      const { onChange, track, slider } = renderRamp('low');

      fireEvent.pointerDown(track, { clientX: 10, button: 0 });
      fireEvent.pointerMove(track, { clientX: 100, pointerType: 'touch' });
      fireEvent.pointerMove(track, { clientX: 125, pointerType: 'touch' });
      expect(slider.getAttribute('aria-valuetext')).toBe('High');
      expect(onChange).not.toHaveBeenCalled();

      // Past the track's end still lands on the last level.
      fireEvent.pointerMove(track, { clientX: 400, pointerType: 'touch' });
      fireEvent.pointerUp(track, { clientX: 400 });

      expect(onChange.mock.calls).toEqual([['high']]);
    });
  });

  describe('when a mouse hovers another level', () => {
    it('leans the pill toward it until the pointer leaves', () => {
      const { track, pill } = renderRamp('low');
      const resting = { left: pill().style.left, right: pill().style.right };

      fireEvent.pointerMove(track, { clientX: 120, pointerType: 'mouse' });
      expect(pill().style.right).not.toBe(resting.right);
      expect(pill().style.right).toContain('6px');
      expect(pill().style.left).toBe(resting.left);

      fireEvent.pointerLeave(track, { pointerType: 'mouse' });
      expect({ left: pill().style.left, right: pill().style.right }).toEqual(resting);
    });

    it('does not lean for a finger, which has no hover', () => {
      const { track, pill } = renderRamp('low');
      const resting = pill().style.right;

      fireEvent.pointerMove(track, { clientX: 120, pointerType: 'touch' });

      expect(pill().style.right).toBe(resting);
    });
  });

  describe('when no level can be picked', () => {
    it('shows why, with no pill and nothing to click', () => {
      const { onChange, track, findPill, slider } = renderRamp(undefined, {
        unavailableReason: 'Pick a model first',
      });

      expect(screen.getByText('Pick a model first')).toBeTruthy();
      expect(findPill()).toBeNull();
      expect(slider).toHaveProperty('disabled', true);

      fireEvent.pointerDown(track, { clientX: 100, button: 0 });
      fireEvent.pointerUp(track, { clientX: 100 });
      expect(onChange).not.toHaveBeenCalled();
    });
  });
});
