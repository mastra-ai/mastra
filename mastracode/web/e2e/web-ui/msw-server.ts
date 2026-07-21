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
interface StoredRepository {
  projectRepositoryId?: string;
  slug?: string;
  gitBranch?: string;
  sandboxWorkdir?: string;
}

interface StoredFactory {
  name?: string;
  binding?: {
    kind?: string;
    factoryProjectId?: string;
    repositories?: StoredRepository[];
  };
}

/**
 * Read persisted server-backed factories from localStorage so the default
 * handlers can reflect them back through the Factory-projects routes, matching
 * what the real server would return after onboarding. Hydration keeps cached
 * worktrees / resource ids, so only the project + repository-link identity
 * needs to round-trip here.
 */
function storedServerFactories(): Array<{ name: string; factoryProjectId: string; repositories: StoredRepository[] }> {
  const raw = globalThis.localStorage?.getItem('mastracode-factories');
  if (!raw) return [];
  try {
    const factories = JSON.parse(raw) as StoredFactory[];
    return factories.flatMap(factory =>
      factory.binding?.kind === 'factory' && factory.binding.factoryProjectId && factory.name
        ? [
            {
              name: factory.name,
              factoryProjectId: factory.binding.factoryProjectId,
              repositories: factory.binding.repositories ?? [],
            },
          ]
        : [],
    );
  } catch {
    return [];
  }
}

export const server = setupServer(
  http.get('*/auth/me', () => HttpResponse.json(null, { status: 404 })),
  // Ambient model catalog for settings pickers; tests with model-specific
  // assertions override it with `server.use(...)`.
  http.get('*/web/config/models', () => HttpResponse.json({ models: [] })),
  http.get('*/web/factory/projects', () =>
    HttpResponse.json({
      projects: storedServerFactories().map(factory => ({ id: factory.factoryProjectId, name: factory.name })),
    }),
  ),
  http.get('*/web/factory/projects/:id/source-control-connections', ({ params }) => {
    const factory = storedServerFactories().find(candidate => candidate.factoryProjectId === params.id);
    if (!factory || factory.repositories.length === 0) return HttpResponse.json({ connections: [] });
    return HttpResponse.json({
      connections: [
        {
          id: `conn-${factory.factoryProjectId}`,
          repositories: factory.repositories.map(link => ({
            id: link.projectRepositoryId,
            branch: link.gitBranch ?? null,
            sandboxWorkdir: link.sandboxWorkdir,
            repository: { slug: link.slug ?? factory.name, defaultBranch: link.gitBranch ?? 'main' },
          })),
        },
      ],
    });
  }),
);
