/**
 * Process-wide registry for factory-resolved deployment configuration.
 *
 * `MastraFactory.prepare()` (see `./factory-entry.ts`) seeds this module with
 * the explicit config the deploy entry passed in. Deep modules that can't be
 * parameterized through every call site (`github/db.ts`, the auth module)
 * consult it via getters instead of reading deployment env themselves.
 *
 * Once seeded, the seeded config wins unconditionally. The env fallback on the
 * database getter applies ONLY before seeding, as back-compat for modules and
 * test suites exercised without booting the factory (existing route suites set
 * `APP_DATABASE_URL` directly); it is slated for removal once all consumers
 * seed the registry.
 */

export interface WebRuntimeConfig {
  /** Postgres connection string for the application database + agent storage. */
  databaseUrl?: string;
  /** Browser-facing origin, normalized without a trailing slash. */
  publicUrl?: string;
}

let seeded: WebRuntimeConfig | undefined;

/** Seed the registry with factory-resolved config. Called once by `MastraFactory.prepare()`. */
export function seedRuntimeConfig(config: WebRuntimeConfig): void {
  seeded = { ...config };
}

/**
 * Postgres connection string for the app tables (github/factory/audit/intake).
 * Falls back to `APP_DATABASE_URL` only when the factory has not seeded the
 * registry (back-compat; see module docs).
 */
export function getAppDatabaseUrl(): string | undefined {
  if (seeded) return seeded.databaseUrl;
  return process.env.APP_DATABASE_URL || undefined;
}

/** Browser-facing origin resolved by the factory, if seeded. */
export function getPublicUrl(): string | undefined {
  return seeded?.publicUrl;
}

/** Reset the registry for test isolation. */
export function __resetRuntimeConfigForTests(): void {
  seeded = undefined;
}
