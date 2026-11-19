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
  });

  describe('when an illustration picks a tone', () => {
    it('defaults the accent to the destructive indicator', () => {
      const { container } = render(
        <CardIllustration>
          <span>$150</span>
        </CardIllustration>,
      );

      const plate = container.firstElementChild;

      expect(plate?.classList.contains('[--illustration-accent:var(--destructive-indicator)]')).toBe(true);
    });

    it.each([
      ['warning', '[--illustration-accent:var(--warning-indicator)]'],
      ['info', '[--illustration-accent:var(--info-indicator)]'],
      ['success', '[--illustration-accent:var(--success-indicator)]'],
    ] as const)('paints a %s illustration with the matching indicator', (tone, accentClass) => {
      const { container } = render(
        <CardIllustration tone={tone}>
          <span>$150</span>
        </CardIllustration>,
      );

      const plate = container.firstElementChild;

      expect(plate?.classList.contains(accentClass)).toBe(true);
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
