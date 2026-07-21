import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

/**
 * Shared MSW server for the jsdom web-ui test suite. The global setup
 * (`vitest.setup.ts`) starts it with `onUnhandledRequest: 'error'` so any
 * request that isn't explicitly stubbed fails the test loudly. Register
 * per-test handlers with `server.use(...)`.
 *
 * `/auth/me` has a default handler because the auth state is ambient (read by
 * the user-sessions plumbing wherever the provider stack renders): auth is
 * reported disabled — the local-dev default — so user sessions fall back to
 * the fixed local resourceId. Tests that exercise authenticated flows override
 * it with `server.use(...)`.
 */
export const server = setupServer(
  http.get('*/auth/me', () => HttpResponse.json(null, { status: 404 })),
  http.get('*/web/github/repositories', () => {
    const raw = globalThis.localStorage?.getItem('mastracode-factories');
    if (!raw) return HttpResponse.json([]);
    try {
      const factories = JSON.parse(raw) as Array<{
        name?: string;
        resourceId?: string;
        createdAt?: number;
        binding?: {
          kind?: string;
          githubProjectId?: string;
          gitBranch?: string;
          sandboxId?: string;
          sandboxWorkdir?: string;
          worktrees?: unknown[];
        };
      }>;
      return HttpResponse.json(
        factories.flatMap(factory => {
          const binding = factory.binding;
          if (binding?.kind !== 'github' || !binding.githubProjectId || !factory.name) return [];
          return [
            {
              id: binding.githubProjectId,
              name: factory.name,
              source: 'github',
              githubProjectId: binding.githubProjectId,
              resourceId: factory.resourceId,
              gitBranch: binding.gitBranch,
              sandboxId: binding.sandboxId,
              sandboxWorkdir: binding.sandboxWorkdir,
              worktrees: binding.worktrees ?? [],
              createdAt: factory.createdAt,
            },
          ];
        }),
      );
    } catch {
      return HttpResponse.json([]);
    }
  }),
);
