import { stringToColor } from '@mastra/playground-ui/utils/colors';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ComputedTag } from '../computed-tag';

afterEach(() => {
  cleanup();
});

// jsdom normalizes inline colors to rgb(...); feed a probe element the same hsl() to get the expected value.
function normalizeColor(color: string) {
  const probe = document.createElement('div');
  probe.style.color = color;
  return probe.style.color;
}

describe('ComputedTag', () => {
  describe('when given a value', () => {
    it('renders the value as the tag label', () => {
      render(<ComputedTag value="alpha" />);

      expect(screen.getByTestId('computed-tag').textContent).toBe('alpha');
    });

    it('derives the background color from the value (lightness 90)', () => {
      render(<ComputedTag value="alpha" />);

      expect(screen.getByTestId('computed-tag').style.backgroundColor).toBe(normalizeColor(stringToColor('alpha')));
    });

    it('derives the foreground color from the value (lightness 25)', () => {
      render(<ComputedTag value="alpha" />);

      expect(screen.getByTestId('computed-tag').style.color).toBe(normalizeColor(stringToColor('alpha', 25)));
    });
  });

  describe('when the same value is rendered twice', () => {
    it('produces identical colors', () => {
      render(
        <>
          <ComputedTag value="alpha" data-testid="first" />
          <ComputedTag value="alpha" data-testid="second" />
        </>,
      );

      expect(screen.getByTestId('first').getAttribute('style')).toBe(
        screen.getByTestId('second').getAttribute('style'),
      );
    });
  });

  describe('when two different values are rendered', () => {
    it('produces different colors', () => {
      render(
        <>
          <ComputedTag value="alpha" data-testid="first" />
          <ComputedTag value="beta" data-testid="second" />
        </>,
      );

      expect(screen.getByTestId('first').getAttribute('style')).not.toBe(
        screen.getByTestId('second').getAttribute('style'),
      );
    });
  });

  describe('when children are provided', () => {
    it('renders the children instead of the raw value while keeping value-derived colors', () => {
      render(
        <ComputedTag value="alpha">
          alpha <button type="button">x</button>
        </ComputedTag>,
      );

      expect(screen.getByRole('button', { name: 'x' })).toBeTruthy();
      expect(screen.getByTestId('computed-tag').style.backgroundColor).toBe(normalizeColor(stringToColor('alpha')));
    });
  });
});
