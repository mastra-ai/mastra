// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { forwardRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { Card, CardIllustration, CardLink } from './Card';

const StubLink = forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement>>(
  function StubLink(props, ref) {
    return <a ref={ref} data-stub-link="true" {...props} />;
  },
);

afterEach(() => {
  cleanup();
});

describe('Card', () => {
  describe('when a card link renders', () => {
    it('preserves native link semantics', () => {
      render(
        <CardLink LinkComponent={StubLink} href="/agents/researcher">
          Research Agent
        </CardLink>,
      );

      const link = screen.getByRole('link', { name: 'Research Agent' });

      expect(link.getAttribute('data-stub-link')).toBe('true');
      expect(link.getAttribute('href')).toBe('/agents/researcher');
      expect(link.getAttribute('role')).toBeNull();
      expect(link.getAttribute('tabindex')).toBeNull();
    });

    it('defaults to a native anchor when only href is supplied', () => {
      render(<CardLink href="/agents/researcher">Research Agent</CardLink>);

      const link = screen.getByRole('link', { name: 'Research Agent' });

      expect(link.tagName).toBe('A');
      expect(link.getAttribute('href')).toBe('/agents/researcher');
    });
  });

  describe('when a card link carries an illustration', () => {
    it('names the link by its words, never by the drawing', () => {
      render(
        <CardLink href="/alerts/new?template=budget">
          <CardIllustration>
            <span>$150</span>
          </CardIllustration>
          <span>Daily cost budget</span> <span>Today's spend past a budget.</span>
        </CardLink>,
      );

      const link = screen.getByRole('link', { name: "Daily cost budget Today's spend past a budget." });

      expect(link.getAttribute('href')).toBe('/alerts/new?template=budget');
      expect(screen.getByText('$150').closest('[aria-hidden="true"]')).not.toBeNull();
    });

    it('tells assistive tech which card is the current one', () => {
      render(
        <CardLink href="/alerts/new?template=budget" aria-current="true">
          <CardIllustration>
            <span>$150</span>
          </CardIllustration>
          Daily cost budget
        </CardLink>,
      );

      expect(screen.getByRole('link', { name: 'Daily cost budget', current: true })).toBeTruthy();
    });

    it('keeps the drawing hidden even when a caller tries to expose it', () => {
      render(
        <CardLink href="/alerts/new?template=budget">
          <CardIllustration aria-hidden={false}>
            <span>$150</span>
          </CardIllustration>
          Daily cost budget
        </CardLink>,
      );

      expect(screen.getByRole('link', { name: 'Daily cost budget' })).toBeTruthy();
      expect(screen.getByText('$150').closest('[aria-hidden="true"]')).not.toBeNull();
    });
  });

  describe('when an interactive card uses its default renderer', () => {
    it('renders with native button semantics', () => {
      render(<Card interactive>Run agent</Card>);

      const button = screen.getByRole('button', { name: 'Run agent' });

      expect(button.tagName).toBe('BUTTON');
      expect(button.getAttribute('type')).toBe('button');
      expect(button.getAttribute('role')).toBeNull();
      expect(button.getAttribute('tabindex')).toBeNull();
    });
  });
});
