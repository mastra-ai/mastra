import type { Mock } from 'vitest';
import { vi } from 'vitest';

/** A spy on one SDK method. */
type MethodSpy = Mock<(...args: unknown[]) => unknown>;

/**
 * The single `@workos-inc/node` mock for this package's test suites.
 *
 * The package runs with `isolate: false`, so every test file shares one module
 * cache: the first file to import a module decides what later files receive,
 * and a later file's own `vi.mock` factory may never run. `index.test.ts` and
 * `fga-provider.test.ts` both need the SDK mocked, with different surfaces, so
 * registering two different mocks made the suites depend on which file ran
 * first (see the `file order` note below).
 *
 * Registering the same mock — and sharing its `vi.fn()`s — from every file
 * removes that dependency: whichever file registers it first, both files get a
 * module with `userManagement`, `organizations` and `authorization`, and read
 * the same spies.
 */

/** Spy on `new WorkOS(apiKey, options)`. */
const construct: Mock<(apiKey?: string, options?: unknown) => void> = vi.fn();

/** Spy on `workos.userManagement.*`. */
const userManagement: Record<string, MethodSpy> = {
  getJwksUrl: vi.fn().mockReturnValue('https://mock-jwks-url'),
  listOrganizationMemberships: vi.fn(),
  getUser: vi.fn(),
  createOrganizationMembership: vi.fn(),
  authenticateWithCode: vi.fn(),
};

/** Spy on `workos.organizations.*`. */
const organizations: Record<string, MethodSpy> = {
  createOrganization: vi.fn(),
  getOrganizationByExternalId: vi.fn(),
};

/** Spy on `workos.authorization.*`. */
const authorization: Record<string, MethodSpy> = {
  check: vi.fn(),
  listResourcesForMembership: vi.fn(),
  createResource: vi.fn(),
  getResource: vi.fn(),
  listResources: vi.fn(),
  updateResource: vi.fn(),
  deleteResource: vi.fn(),
  deleteResourceByExternalId: vi.fn(),
  assignRole: vi.fn(),
  removeRole: vi.fn(),
  listRoleAssignments: vi.fn(),
};

export const workosSdkMock: {
  construct: Mock<(apiKey?: string, options?: unknown) => void>;
  userManagement: Record<string, MethodSpy>;
  organizations: Record<string, MethodSpy>;
  authorization: Record<string, MethodSpy>;
} = { construct, userManagement, organizations, authorization };

export const GenerateLinkIntent = {
  SSO: 'sso',
  DSync: 'dsync',
  AuditLogs: 'audit_logs',
  LogStreams: 'log_streams',
};

export class WorkOS {
  userManagement = workosSdkMock.userManagement;
  organizations = workosSdkMock.organizations;
  authorization = workosSdkMock.authorization;

  constructor(apiKey?: string, options?: unknown) {
    workosSdkMock.construct(apiKey, options);
  }
}
