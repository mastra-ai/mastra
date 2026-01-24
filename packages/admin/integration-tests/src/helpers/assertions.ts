import type { User, Team, Project, Deployment, Build } from '@mastra/admin';
import { expect } from 'vitest';

/**
 * Assert that a user object has all required fields.
 */
export function assertValidUser(user: User): void {
  expect(user.id).toBeDefined();
  expect(user.id).toMatch(/^[0-9a-f-]{36}$/);
  expect(user.email).toBeDefined();
  expect(user.email).toMatch(/@/);
  expect(user.createdAt).toBeInstanceOf(Date);
  expect(user.updatedAt).toBeInstanceOf(Date);
}

/**
 * Assert that a team object has all required fields.
 */
export function assertValidTeam(team: Team): void {
  expect(team.id).toBeDefined();
  expect(team.id).toMatch(/^[0-9a-f-]{36}$/);
  expect(team.name).toBeDefined();
  expect(team.name.length).toBeGreaterThan(0);
  expect(team.slug).toBeDefined();
  expect(team.slug).toMatch(/^[a-z0-9-]+$/);
  expect(team.settings).toBeDefined();
  expect(team.createdAt).toBeInstanceOf(Date);
  expect(team.updatedAt).toBeInstanceOf(Date);
}

/**
 * Assert that a project object has all required fields.
 */
export function assertValidProject(project: Project): void {
  expect(project.id).toBeDefined();
  expect(project.id).toMatch(/^[0-9a-f-]{36}$/);
  expect(project.teamId).toBeDefined();
  expect(project.name).toBeDefined();
  expect(project.slug).toBeDefined();
  expect(['local', 'github']).toContain(project.sourceType);
  expect(project.sourceConfig).toBeDefined();
  expect(project.defaultBranch).toBeDefined();
  expect(project.envVars).toBeDefined();
  expect(Array.isArray(project.envVars)).toBe(true);
  expect(project.createdAt).toBeInstanceOf(Date);
  expect(project.updatedAt).toBeInstanceOf(Date);
}

/**
 * Assert that a deployment object has all required fields.
 */
export function assertValidDeployment(deployment: Deployment): void {
  expect(deployment.id).toBeDefined();
  expect(deployment.id).toMatch(/^[0-9a-f-]{36}$/);
  expect(deployment.projectId).toBeDefined();
  expect(['production', 'staging', 'preview']).toContain(deployment.type);
  expect(deployment.branch).toBeDefined();
  expect(deployment.slug).toBeDefined();
  expect(['pending', 'building', 'running', 'stopped', 'failed']).toContain(deployment.status);
  expect(deployment.createdAt).toBeInstanceOf(Date);
  expect(deployment.updatedAt).toBeInstanceOf(Date);
}

/**
 * Assert that a build object has all required fields.
 */
export function assertValidBuild(build: Build): void {
  expect(build.id).toBeDefined();
  expect(build.id).toMatch(/^[0-9a-f-]{36}$/);
  expect(build.deploymentId).toBeDefined();
  expect(['manual', 'webhook', 'schedule', 'rollback']).toContain(build.trigger);
  expect(build.triggeredBy).toBeDefined();
  expect(build.commitSha).toBeDefined();
  expect(['queued', 'building', 'deploying', 'succeeded', 'failed', 'cancelled']).toContain(build.status);
  expect(build.logs).toBeDefined();
  expect(build.queuedAt).toBeInstanceOf(Date);
}

/**
 * Assert that an error matches expected properties.
 */
export function assertErrorMatches(error: unknown, expectedMessage: string | RegExp, expectedCode?: string): void {
  expect(error).toBeDefined();
  expect(error).toBeInstanceOf(Error);

  const err = error as Error;

  if (typeof expectedMessage === 'string') {
    expect(err.message).toContain(expectedMessage);
  } else {
    expect(err.message).toMatch(expectedMessage);
  }

  if (expectedCode && 'code' in err) {
    expect((err as { code: string }).code).toBe(expectedCode);
  }
}

/**
 * Wait for a condition to be true with timeout.
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: { timeout?: number; interval?: number; message?: string } = {},
): Promise<void> {
  const { timeout = 5000, interval = 100, message = 'Condition not met within timeout' } = options;

  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error(message);
}

/**
 * Assert that an operation completes within a time limit.
 */
export async function assertOperationTime<T>(operation: () => Promise<T>, maxDurationMs: number): Promise<T> {
  const startTime = Date.now();
  const result = await operation();
  const duration = Date.now() - startTime;

  expect(duration).toBeLessThan(maxDurationMs);
  return result;
}

/**
 * Assert that a paginated result has correct structure.
 */
export function assertValidPaginatedResult<T>(
  result: { data: T[]; total: number; page: number; perPage: number; hasMore: boolean },
  expectedPage: number = 1,
  expectedPerPage: number = 20,
): void {
  expect(result.data).toBeDefined();
  expect(Array.isArray(result.data)).toBe(true);
  expect(typeof result.total).toBe('number');
  expect(result.total).toBeGreaterThanOrEqual(0);
  expect(result.page).toBe(expectedPage);
  expect(result.perPage).toBe(expectedPerPage);
  expect(typeof result.hasMore).toBe('boolean');

  // hasMore should be true if there are more items beyond this page
  const expectedHasMore = result.total > result.page * result.perPage;
  expect(result.hasMore).toBe(expectedHasMore);
}
