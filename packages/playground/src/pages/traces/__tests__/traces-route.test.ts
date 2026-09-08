import { createMemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { routes } from '@/App';

async function navigateTo(entry: string) {
  const router = createMemoryRouter(routes, { initialEntries: [entry] });
  await new Promise<void>(resolve => {
    if (router.state.initialized) return resolve();
    const unsubscribe = router.subscribe(state => {
      if (!state.initialized) return;
      unsubscribe();
      resolve();
    });
  });
  return router;
}

describe('traces routes', () => {
  describe('when /traces is opened directly', () => {
    it('serves the traces list', async () => {
      const router = await navigateTo('/traces');

      expect(router.state.errors).toBeNull();
      expect(router.state.matches.at(-1)?.route.path).toBe('/traces');
    });
  });

  describe('when a legacy /traces/:traceId link is opened', () => {
    it('redirects to /traces with the traceId as a search param', async () => {
      const router = await navigateTo('/traces/trace-1?spanId=span-1');

      expect(router.state.location.pathname).toBe('/traces');
      expect(router.state.location.search).toBe('?spanId=span-1&traceId=trace-1');
    });
  });

  describe('when a legacy /observability link is opened', () => {
    it('redirects to /traces and keeps its filters', async () => {
      const router = await navigateTo('/observability?entity=weather');

      expect(router.state.location.pathname).toBe('/traces');
      expect(router.state.location.search).toBe('?entity=weather');
    });
  });
});
