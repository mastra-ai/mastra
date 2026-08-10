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

  describe('when a legacy /observability link is opened', () => {
    it('redirects to /traces and keeps its filters', async () => {
      const router = await navigateTo('/observability?entity=weather');

      expect(router.state.location.pathname).toBe('/traces');
      expect(router.state.location.search).toBe('?entity=weather');
    });
  });
});
