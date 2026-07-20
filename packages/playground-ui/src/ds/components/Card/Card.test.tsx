// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { forwardRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

  describe('when an interactive card renders as a non-semantic element', () => {
    it('activates from the keyboard', () => {
      const onClick = vi.fn();
      render(
        <Card interactive onClick={onClick}>
          Run agent
        </Card>,
      );

      const button = screen.getByRole('button', { name: 'Run agent' });
      fireEvent.keyDown(button, { key: 'Enter' });
      fireEvent.keyDown(button, { key: ' ' });

      expect(onClick).toHaveBeenCalledTimes(2);
    });
  });
});
