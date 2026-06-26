/**
 * Stable, scoped React Query keys for the settings API.
 *
 * Resource-scoped lists (model packs, OM) include the `resourceId` so switching
 * projects yields a distinct cache entry instead of leaking another project's
 * data. Keeping every key in one place makes invalidation in the mutation hooks
 * unambiguous.
 */
export const queryKeys = {
  providers: () => ['providers'] as const,
  customProviders: () => ['custom-providers'] as const,
  modelPacks: (resourceId: string | undefined) => ['model-packs', resourceId ?? null] as const,
  om: (resourceId: string | undefined) => ['om', resourceId ?? null] as const,
  fsList: (path: string | undefined) => ['fs-list', path ?? null] as const,
} as const;
