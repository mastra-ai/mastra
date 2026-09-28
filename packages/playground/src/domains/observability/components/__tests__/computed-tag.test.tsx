import { hueForName } from '@mastra/playground-ui/utils/colors';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ComputedTag } from '../computed-tag';

afterEach(() => {
  cleanup();
});

describe('ComputedTag', () => {
  describe('when given a value', () => {
    it('renders the value as the tag label', () => {
      render(<ComputedTag value="alpha" />);

      expect(screen.getByTestId('computed-tag').textContent).toBe('alpha');
    });

    it('colors the tag with the badge hue derived from the value', () => {
      render(<ComputedTag value="alpha" />);

      const hue = hueForName('alpha');
      expect(screen.getByTestId('computed-tag').className).toContain(`bg-badge-${hue}`);
      expect(screen.getByTestId('computed-tag').className).toContain(`text-badge-${hue}-fg`);
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

      expect(screen.getByTestId('first').className).toBe(screen.getByTestId('second').className);
    });
  });

  describe('when two values hash to different hues', () => {
    it('produces different colors', () => {
      render(
        <>
          <ComputedTag value="alpha" data-testid="first" />
          <ComputedTag value="beta" data-testid="second" />
        </>,
      );

      expect(hueForName('alpha')).not.toBe(hueForName('beta'));
      expect(screen.getByTestId('first').className).not.toBe(screen.getByTestId('second').className);
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
      expect(screen.getByTestId('computed-tag').className).toContain(`bg-badge-${hueForName('alpha')}`);
    });
  });
});
