// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import SignalsOverviewPage from '..';
import { populatedThemeEntitiesResponse } from './fixtures/theme-flow';
import { server } from '@/test/msw-server';

const BASE_URL = window.location.origin;

beforeAll(() => {
  if (typeof window.PointerEvent === 'undefined') {
    window.PointerEvent = window.MouseEvent as unknown as typeof PointerEvent;
  }
});

afterEach(() => cleanup());

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="Current URL">{`${location.pathname}${location.search}`}</output>;
}

function renderIndex(initialEntry = '/intelligence') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <QueryClientProvider client={queryClient}>
        <SignalsOverviewPage />
        <LocationProbe />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('Trace Intelligence index route', () => {
  describe('when entities are available', () => {
    it('shows the index without selecting or loading entity analysis', async () => {
      server.use(
        http.get(`${BASE_URL}/api/learning/entities`, () => HttpResponse.json(populatedThemeEntitiesResponse)),
      );

      renderIndex();

      expect(await screen.findByText('support-agent')).not.toBeNull();
      expect(screen.queryByRole('region', { name: 'Trace signal theme flow' })).toBeNull();
      expect(screen.getByRole('link', { name: 'Open entity support-agent' }).getAttribute('href')).toBe(
        '/intelligence/entities/agent/support-agent',
      );
    });

    it('restores search, sort, and view from URL search parameters', async () => {
      server.use(
        http.get(`${BASE_URL}/api/learning/entities`, () => HttpResponse.json(populatedThemeEntitiesResponse)),
      );

      renderIndex('/intelligence?search=support&sort=entity-desc&view=compact');

      expect(await screen.findByRole('link', { name: 'Open support-agent' })).not.toBeNull();
      expect(screen.getByRole('textbox', { name: 'Filter entities' }).getAttribute('value')).toBe('support');
      expect(screen.getByRole('combobox', { name: 'Sort entities' }).textContent).toContain('Entity: Z–A');
      expect(screen.getByRole('button', { name: 'Compact view' }).getAttribute('aria-pressed')).toBe('true');
    });

    it('writes controlled index changes to URL search parameters', async () => {
      server.use(
        http.get(`${BASE_URL}/api/learning/entities`, () => HttpResponse.json(populatedThemeEntitiesResponse)),
      );

      renderIndex();
      await screen.findByText('support-agent');
      fireEvent.change(screen.getByRole('textbox', { name: 'Filter entities' }), { target: { value: 'support' } });
      fireEvent.click(screen.getByRole('button', { name: 'Compact view' }));
      fireEvent.click(screen.getByRole('combobox', { name: 'Sort entities' }));
      const option = await screen.findByRole('option', { name: 'Entity: A–Z' });
      fireEvent.pointerDown(option, { pointerType: 'mouse' });
      fireEvent.click(option, { detail: 1 });

      await waitFor(() => {
        const url = screen.getByRole('status', { name: 'Current URL' }).textContent;
        expect(url).toContain('search=support');
        expect(url).toContain('sort=entity-asc');
        expect(url).toContain('view=compact');
      });
    });
  });
});
