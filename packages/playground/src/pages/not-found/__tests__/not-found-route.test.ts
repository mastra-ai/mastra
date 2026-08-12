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

describe('not-found route', () => {
  describe('when an unknown Studio URL is opened', () => {
    it('serves the catch-all page', async () => {
      const router = await navigateTo('/missing-page');

      expect(router.state.errors).toBeNull();
      expect(router.state.matches.at(-1)?.route.path).toBe('*');
    });
  });
});
