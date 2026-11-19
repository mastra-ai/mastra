import { describe, expect, it } from 'vitest';
import { MASTRA_NORMALIZED_USER_KEY, RequestContext } from '../request-context';
import type { MastraUser } from '../types';
import { getRequestUser, resolveDynamicArgument } from './dynamic-argument';

const testUser: MastraUser = {
  id: 'user-1',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  role: 'admin',
};

describe('getRequestUser', () => {
  it('returns the normalized user stored on the request context', () => {
    const requestContext = new RequestContext();
    requestContext.setRaw(MASTRA_NORMALIZED_USER_KEY, testUser);

    expect(getRequestUser(requestContext)).toEqual(testUser);
  });

  it('returns undefined when no user is stored', () => {
    expect(getRequestUser(new RequestContext())).toBeUndefined();
  });

  it('returns undefined when the stored value is malformed', () => {
    const missingId = new RequestContext();
    missingId.setRaw(MASTRA_NORMALIZED_USER_KEY, { name: 'No Id' });
    expect(getRequestUser(missingId)).toBeUndefined();

    const nonObject = new RequestContext();
    nonObject.setRaw(MASTRA_NORMALIZED_USER_KEY, 'user-1');
    expect(getRequestUser(nonObject)).toBeUndefined();
  });
});

describe('resolveDynamicArgument', () => {
  it('passes static values through unchanged', () => {
    const requestContext = new RequestContext();

    expect(resolveDynamicArgument('hello', { requestContext })).toBe('hello');

    const staticObject = { some: 'config' };
    expect(resolveDynamicArgument(staticObject, { requestContext })).toBe(staticObject);
  });

  it('invokes callbacks with requestContext and mastra', () => {
    const requestContext = new RequestContext();
    const mastra = { fake: true } as any;

    const result = resolveDynamicArgument(({ requestContext: ctx, mastra: m }) => ({ ctx, m }), {
      requestContext,
      mastra,
    });

    expect(result).toEqual({ ctx: requestContext, m: mastra });
  });

  it('invokes callbacks with the user from the request context', () => {
    const requestContext = new RequestContext();
    requestContext.setRaw(MASTRA_NORMALIZED_USER_KEY, testUser);

    const result = resolveDynamicArgument(({ user }) => user, { requestContext });

    expect(result).toEqual(testUser);
  });

  it('invokes callbacks with user undefined when the request is unauthenticated', () => {
    const requestContext = new RequestContext();

    const result = resolveDynamicArgument(({ user }) => user ?? 'anonymous', { requestContext });

    expect(result).toBe('anonymous');
  });

  it('supports async callbacks', async () => {
    const requestContext = new RequestContext();
    requestContext.setRaw(MASTRA_NORMALIZED_USER_KEY, testUser);

    const result = resolveDynamicArgument(async ({ user }) => `instructions for ${user?.id}`, { requestContext });

    await expect(result).resolves.toBe('instructions for user-1');
  });
});
