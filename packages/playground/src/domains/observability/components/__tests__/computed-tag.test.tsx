import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ComputedTag } from '../computed-tag';

afterEach(() => {
  cleanup();
});

const BADGE_FILL = /(^|\s)bg-badge-[a-z]+-strong(\s|$)/;

describe('ComputedTag', () => {
  describe('when given a value', () => {
    it('renders the value as the tag label', () => {
      render(<ComputedTag value="alpha" />);

      expect(screen.getByTestId('computed-tag').textContent).toBe('alpha');
    });

    it('fills the tag with a categorical badge hue', () => {
      render(<ComputedTag value="alpha" />);

      expect(screen.getByTestId('computed-tag').className).toMatch(BADGE_FILL);
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

      expect(screen.getByTestId('first').className).not.toBe(screen.getByTestId('second').className);
    });
  });

  describe('when children are provided', () => {
    it('renders the children instead of the raw value while keeping value-derived colors', () => {
      render(
        <>
          <ComputedTag value="alpha" data-testid="with-children">
            alpha <button type="button">x</button>
          </ComputedTag>
          <ComputedTag value="alpha" data-testid="without-children" />
        </>,
      );

      expect(screen.getByRole('button', { name: 'x' })).toBeTruthy();
      expect(screen.getByTestId('with-children').className).toBe(screen.getByTestId('without-children').className);
    });
  });
});
