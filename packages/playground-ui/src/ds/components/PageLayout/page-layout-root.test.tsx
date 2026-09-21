// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PageLayoutRoot } from './page-layout-root';

afterEach(cleanup);

describe('PageLayoutRoot', () => {
  describe('when breadcrumbs and actions are provided', () => {
    it('renders them inside a header above the main content', () => {
      render(
        <PageLayoutRoot breadcrumbs={<span>Crumbs</span>} actions={<button>Act</button>}>
          <p>Body</p>
        </PageLayoutRoot>,
      );

      const header = screen.getByRole('banner');
      expect(header.textContent).toContain('Crumbs');
      expect(header.contains(screen.getByRole('button', { name: 'Act' }))).toBe(true);
      expect(header.compareDocumentPosition(screen.getByRole('main')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });

  describe('when neither breadcrumbs nor actions are provided', () => {
    it('does not render a header', () => {
      render(
        <PageLayoutRoot>
          <p>Body</p>
        </PageLayoutRoot>,
      );

      expect(screen.queryByRole('banner')).toBeNull();
      expect(screen.getByRole('main').textContent).toBe('Body');
    });
  });

  describe('when a heading is provided', () => {
    it('renders a visually hidden h1', () => {
      render(
        <PageLayoutRoot heading="Agents">
          <p>Body</p>
        </PageLayoutRoot>,
      );

      expect(screen.getByRole('heading', { level: 1, name: 'Agents' }).className).toContain('sr-only');
    });
  });
});
