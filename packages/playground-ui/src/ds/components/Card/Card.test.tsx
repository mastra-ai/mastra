// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { forwardRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { Card, CardLink } from './Card';

const StubLink = forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement>>(
  function StubLink(props, ref) {
    return <a ref={ref} {...props} />;
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

  describe('when an interactive card renders as a button', () => {
    it('preserves native button semantics', () => {
      render(
        <Card as="button" interactive>
          Run agent
        </Card>,
      );

      const button = screen.getByRole('button', { name: 'Run agent' });

      expect(button.tagName).toBe('BUTTON');
      expect(button.getAttribute('role')).toBeNull();
      expect(button.getAttribute('tabindex')).toBeNull();
    });
  });
});
