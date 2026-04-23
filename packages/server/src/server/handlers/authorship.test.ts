import { MASTRA_RESOURCE_ID_KEY, RequestContext } from '@mastra/core/request-context';
import { describe, expect, it } from 'vitest';

import { HTTPException } from '../http-exception';
import {
  assertOwnership,
  assertExecuteAccess,
  assertReadAccess,
  assertWriteAccess,
  getCallerAuthorId,
  hasAdminBypass,
  hasScopedPermission,
  matchesAuthorFilter,
  resolveAuthorFilter,
} from './authorship';

function ctxWith(entries: Record<string, unknown>): RequestContext {
  const ctx = new RequestContext();
  for (const [key, value] of Object.entries(entries)) {
    ctx.set(key, value);
  }
  return ctx;
}

describe('authorship', () => {
  describe('getCallerAuthorId', () => {
    it('prefers MASTRA_RESOURCE_ID_KEY over user.id', () => {
      const ctx = ctxWith({
        [MASTRA_RESOURCE_ID_KEY]: 'resource-123',
        user: { id: 'user-xyz' },
      });
      expect(getCallerAuthorId(ctx)).toBe('resource-123');
    });

    it('falls back to user.id when resource id is missing', () => {
      const ctx = ctxWith({ user: { id: 'user-xyz' } });
      expect(getCallerAuthorId(ctx)).toBe('user-xyz');
    });

    it('returns null when neither is set', () => {
      expect(getCallerAuthorId(new RequestContext())).toBeNull();
    });

    it('returns null when resource id is empty or non-string', () => {
      const ctx = ctxWith({ [MASTRA_RESOURCE_ID_KEY]: '', user: { id: 123 } });
      expect(getCallerAuthorId(ctx)).toBeNull();
    });
  });

  describe('hasAdminBypass', () => {
    it('grants bypass for `*`', () => {
      const ctx = ctxWith({ userPermissions: ['*'] });
      expect(hasAdminBypass(ctx, 'stored-agents')).toBe(true);
    });

    it('grants bypass for `<resource>:*`', () => {
      const ctx = ctxWith({ userPermissions: ['stored-agents:*'] });
      expect(hasAdminBypass(ctx, 'stored-agents')).toBe(true);
    });

    it('grants bypass for `<resource>:admin`', () => {
      const ctx = ctxWith({ userPermissions: ['stored-agents:admin'] });
      expect(hasAdminBypass(ctx, 'stored-agents')).toBe(true);
    });

    it('denies bypass for unrelated wildcards or read-only perms', () => {
      const ctx = ctxWith({ userPermissions: ['stored-agents:read', 'workflows:*'] });
      expect(hasAdminBypass(ctx, 'stored-agents')).toBe(false);
    });

    it('denies bypass when no permissions are attached', () => {
      expect(hasAdminBypass(new RequestContext(), 'stored-agents')).toBe(false);
    });
  });

  describe('resolveAuthorFilter', () => {
    it('returns unrestricted for admins without a query override', () => {
      const ctx = ctxWith({
        user: { id: 'admin' },
        userPermissions: ['*'],
      });
      const filter = resolveAuthorFilter({ requestContext: ctx, resource: 'stored-agents' });
      expect(filter).toEqual({ kind: 'unrestricted' });
    });

    it('returns exact filter for admins with ?authorId=', () => {
      const ctx = ctxWith({
        user: { id: 'admin' },
        userPermissions: ['stored-agents:admin'],
      });
      const filter = resolveAuthorFilter({
        requestContext: ctx,
        resource: 'stored-agents',
        queryAuthorId: 'someone-else',
      });
      expect(filter).toEqual({ kind: 'exact', authorId: 'someone-else' });
    });

    it('returns ownedOrPublic for a plain caller without a query override', () => {
      const ctx = ctxWith({ user: { id: 'user-1' } });
      const filter = resolveAuthorFilter({ requestContext: ctx, resource: 'stored-agents' });
      expect(filter).toEqual({ kind: 'ownedOrPublic', callerAuthorId: 'user-1' });
    });

    it('returns exact filter when caller queries their own authorId', () => {
      const ctx = ctxWith({ user: { id: 'user-1' } });
      const filter = resolveAuthorFilter({
        requestContext: ctx,
        resource: 'stored-agents',
        queryAuthorId: 'user-1',
      });
      expect(filter).toEqual({ kind: 'exact', authorId: 'user-1' });
    });

    it("scopes to another author's public records when caller queries someone else's authorId", () => {
      const ctx = ctxWith({ user: { id: 'user-1' } });
      const filter = resolveAuthorFilter({
        requestContext: ctx,
        resource: 'stored-agents',
        queryAuthorId: 'user-2',
      });
      expect(filter).toEqual({ kind: 'ownedOrPublicOthers', callerAuthorId: 'user-1', queryAuthorId: 'user-2' });
    });

    it('returns publicOnly when ?visibility=public is supplied', () => {
      const ctx = ctxWith({ user: { id: 'user-1' } });
      const filter = resolveAuthorFilter({
        requestContext: ctx,
        resource: 'stored-agents',
        queryVisibility: 'public',
      });
      expect(filter).toEqual({ kind: 'publicOnly' });
    });

    it('falls back to unrestricted when auth is not configured', () => {
      const filter = resolveAuthorFilter({
        requestContext: new RequestContext(),
        resource: 'stored-agents',
      });
      expect(filter).toEqual({ kind: 'unrestricted' });
    });
  });

  describe('matchesAuthorFilter', () => {
    it('unrestricted matches everything', () => {
      expect(matchesAuthorFilter({ authorId: 'x' }, { kind: 'unrestricted' })).toBe(true);
      expect(matchesAuthorFilter({ authorId: null }, { kind: 'unrestricted' })).toBe(true);
      expect(matchesAuthorFilter({}, { kind: 'unrestricted' })).toBe(true);
    });

    it('exact requires owner equality', () => {
      const f = { kind: 'exact', authorId: 'a' } as const;
      expect(matchesAuthorFilter({ authorId: 'a' }, f)).toBe(true);
      expect(matchesAuthorFilter({ authorId: 'b' }, f)).toBe(false);
      expect(matchesAuthorFilter({ authorId: null }, f)).toBe(false);
      expect(matchesAuthorFilter({}, f)).toBe(false);
    });

    it('ownedOrPublic matches the caller, unowned rows, and any public rows', () => {
      const f = { kind: 'ownedOrPublic', callerAuthorId: 'a' } as const;
      expect(matchesAuthorFilter({ authorId: 'a' }, f)).toBe(true);
      expect(matchesAuthorFilter({ authorId: null }, f)).toBe(true);
      expect(matchesAuthorFilter({}, f)).toBe(true);
      expect(matchesAuthorFilter({ authorId: 'b' }, f)).toBe(false);
      // Another owner's public rows ARE included in the default list.
      expect(matchesAuthorFilter({ authorId: 'b', visibility: 'public' }, f)).toBe(true);
    });

    it('publicOnly matches public records and legacy unowned records', () => {
      const f = { kind: 'publicOnly' } as const;
      expect(matchesAuthorFilter({ authorId: 'a', visibility: 'public' }, f)).toBe(true);
      expect(matchesAuthorFilter({ authorId: null }, f)).toBe(true);
      expect(matchesAuthorFilter({ authorId: 'a', visibility: 'private' }, f)).toBe(false);
      expect(matchesAuthorFilter({ authorId: 'a' }, f)).toBe(false);
    });

    it("ownedOrPublicOthers only exposes the queried author's public rows", () => {
      const f = { kind: 'ownedOrPublicOthers', callerAuthorId: 'me', queryAuthorId: 'them' } as const;
      expect(matchesAuthorFilter({ authorId: 'them', visibility: 'public' }, f)).toBe(true);
      expect(matchesAuthorFilter({ authorId: 'them', visibility: 'private' }, f)).toBe(false);
      expect(matchesAuthorFilter({ authorId: 'me', visibility: 'public' }, f)).toBe(false);
      expect(matchesAuthorFilter({ authorId: null }, f)).toBe(false);
    });
  });

  describe('hasScopedPermission', () => {
    it('does NOT match a broad `<resource>:<action>` grant when a resourceId is being checked', () => {
      // Broad role grants (e.g. `agents:execute` in the WorkOS `member` role)
      // must not short-circuit per-record ownership checks. They gate route
      // access at the `requiresPermission` layer instead.
      const ctx = ctxWith({ userPermissions: ['agents:edit'] });
      expect(hasScopedPermission({ requestContext: ctx, resource: 'agents', action: 'edit', resourceId: 'a1' })).toBe(
        false,
      );
    });

    it('matches when caller holds `<resource>:<action>:<resourceId>`', () => {
      const ctx = ctxWith({ userPermissions: ['agents:edit:a1'] });
      expect(hasScopedPermission({ requestContext: ctx, resource: 'agents', action: 'edit', resourceId: 'a1' })).toBe(
        true,
      );
    });

    it('does not match a different resourceId', () => {
      const ctx = ctxWith({ userPermissions: ['agents:edit:a1'] });
      expect(hasScopedPermission({ requestContext: ctx, resource: 'agents', action: 'edit', resourceId: 'a2' })).toBe(
        false,
      );
    });

    it('does not match a different action', () => {
      const ctx = ctxWith({ userPermissions: ['agents:read:a1'] });
      expect(hasScopedPermission({ requestContext: ctx, resource: 'agents', action: 'edit', resourceId: 'a1' })).toBe(
        false,
      );
    });

    it('falls back to broad-grant matching when called without a resourceId', () => {
      const ctx = ctxWith({ userPermissions: ['agents:edit'] });
      expect(hasScopedPermission({ requestContext: ctx, resource: 'agents', action: 'edit' })).toBe(true);
    });
  });

  describe('assertReadAccess', () => {
    it('passes for public records even when caller is not the owner', () => {
      const ctx = ctxWith({ user: { id: 'someone-else' } });
      expect(() =>
        assertReadAccess({
          requestContext: ctx,
          resource: 'agents',
          resourceId: 'a1',
          record: { authorId: 'owner', visibility: 'public' },
        }),
      ).not.toThrow();
    });

    it('passes when caller holds scoped read permission', () => {
      const ctx = ctxWith({
        user: { id: 'someone-else' },
        userPermissions: ['agents:read:a1'],
      });
      expect(() =>
        assertReadAccess({
          requestContext: ctx,
          resource: 'agents',
          resourceId: 'a1',
          record: { authorId: 'owner', visibility: 'private' },
        }),
      ).not.toThrow();
    });

    it('throws 404 for private records from another owner without perms', () => {
      const ctx = ctxWith({ user: { id: 'someone-else' } });
      expect(() =>
        assertReadAccess({
          requestContext: ctx,
          resource: 'agents',
          resourceId: 'a1',
          record: { authorId: 'owner', visibility: 'private' },
        }),
      ).toThrow(HTTPException);
    });

    it('throws 404 when caller has a broad `agents:read` grant but not id-scoped', () => {
      const ctx = ctxWith({
        user: { id: 'someone-else' },
        userPermissions: ['agents:read'],
      });
      expect(() =>
        assertReadAccess({
          requestContext: ctx,
          resource: 'agents',
          resourceId: 'a1',
          record: { authorId: 'owner', visibility: 'private' },
        }),
      ).toThrow(HTTPException);
    });
  });

  describe('assertExecuteAccess', () => {
    it('passes for public records even when caller is not the owner', () => {
      const ctx = ctxWith({ user: { id: 'someone-else' } });
      expect(() =>
        assertExecuteAccess({
          requestContext: ctx,
          resource: 'agents',
          resourceId: 'a1',
          record: { authorId: 'owner', visibility: 'public' },
        }),
      ).not.toThrow();
    });

    it('passes when caller holds scoped `agents:execute:<id>`', () => {
      const ctx = ctxWith({
        user: { id: 'someone-else' },
        userPermissions: ['agents:execute:a1'],
      });
      expect(() =>
        assertExecuteAccess({
          requestContext: ctx,
          resource: 'agents',
          resourceId: 'a1',
          record: { authorId: 'owner', visibility: 'private' },
        }),
      ).not.toThrow();
    });

    it('passes when caller holds scoped `agents:read:<id>` (read implies execute)', () => {
      const ctx = ctxWith({
        user: { id: 'someone-else' },
        userPermissions: ['agents:read:a1'],
      });
      expect(() =>
        assertExecuteAccess({
          requestContext: ctx,
          resource: 'agents',
          resourceId: 'a1',
          record: { authorId: 'owner', visibility: 'private' },
        }),
      ).not.toThrow();
    });

    it('throws 404 for private records from another owner without perms', () => {
      const ctx = ctxWith({ user: { id: 'someone-else' } });
      expect(() =>
        assertExecuteAccess({
          requestContext: ctx,
          resource: 'agents',
          resourceId: 'a1',
          record: { authorId: 'owner', visibility: 'private' },
        }),
      ).toThrow(HTTPException);
    });

    it('throws 404 when caller has a broad `agents:execute` grant but not id-scoped', () => {
      // Default `member` role ships with `agents:execute`. That's fine for
      // code-defined / public / owned agents, but it must NOT let the caller
      // execute a private agent owned by somebody else.
      const ctx = ctxWith({
        user: { id: 'someone-else' },
        userPermissions: ['agents:read', 'agents:execute'],
      });
      expect(() =>
        assertExecuteAccess({
          requestContext: ctx,
          resource: 'agents',
          resourceId: 'a1',
          record: { authorId: 'owner', visibility: 'private' },
        }),
      ).toThrow(HTTPException);
    });

    it('rejects execute when scoped permission is only for a different id', () => {
      const ctx = ctxWith({
        user: { id: 'someone-else' },
        userPermissions: ['agents:execute:a2'],
      });
      expect(() =>
        assertExecuteAccess({
          requestContext: ctx,
          resource: 'agents',
          resourceId: 'a1',
          record: { authorId: 'owner', visibility: 'private' },
        }),
      ).toThrow(HTTPException);
    });
  });

  describe('assertWriteAccess', () => {
    it('denies access to public records owned by someone else', () => {
      const ctx = ctxWith({ user: { id: 'someone-else' } });
      expect(() =>
        assertWriteAccess({
          requestContext: ctx,
          resource: 'agents',
          resourceId: 'a1',
          action: 'edit',
          record: { authorId: 'owner', visibility: 'public' },
        }),
      ).toThrow(HTTPException);
    });

    it('allows edit when caller holds scoped `agents:edit:<id>`', () => {
      const ctx = ctxWith({
        user: { id: 'someone-else' },
        userPermissions: ['agents:edit:a1'],
      });
      expect(() =>
        assertWriteAccess({
          requestContext: ctx,
          resource: 'agents',
          resourceId: 'a1',
          action: 'edit',
          record: { authorId: 'owner', visibility: 'private' },
        }),
      ).not.toThrow();
    });

    it('allows delete when caller holds scoped `agents:delete:<id>`', () => {
      const ctx = ctxWith({
        user: { id: 'someone-else' },
        userPermissions: ['agents:delete:a1'],
      });
      expect(() =>
        assertWriteAccess({
          requestContext: ctx,
          resource: 'agents',
          resourceId: 'a1',
          action: 'delete',
          record: { authorId: 'owner', visibility: 'private' },
        }),
      ).not.toThrow();
    });

    it('rejects delete when scoped permission is only for a different id', () => {
      const ctx = ctxWith({
        user: { id: 'someone-else' },
        userPermissions: ['agents:delete:a2'],
      });
      expect(() =>
        assertWriteAccess({
          requestContext: ctx,
          resource: 'agents',
          resourceId: 'a1',
          action: 'delete',
          record: { authorId: 'owner', visibility: 'private' },
        }),
      ).toThrow(HTTPException);
    });
  });

  describe('assertOwnership', () => {
    it('passes when the record has no owner', () => {
      expect(() =>
        assertOwnership({
          requestContext: new RequestContext(),
          resource: 'stored-agents',
          record: { authorId: null },
        }),
      ).not.toThrow();
    });

    it('passes when caller owns the record', () => {
      const ctx = ctxWith({ user: { id: 'a' } });
      expect(() =>
        assertOwnership({ requestContext: ctx, resource: 'stored-agents', record: { authorId: 'a' } }),
      ).not.toThrow();
    });

    it('passes with admin bypass regardless of owner', () => {
      const ctx = ctxWith({
        user: { id: 'admin' },
        userPermissions: ['*'],
      });
      expect(() =>
        assertOwnership({ requestContext: ctx, resource: 'stored-agents', record: { authorId: 'someone' } }),
      ).not.toThrow();
    });

    it('throws 404 on ownership mismatch without bypass', () => {
      const ctx = ctxWith({ user: { id: 'a' } });
      expect(() =>
        assertOwnership({ requestContext: ctx, resource: 'stored-agents', record: { authorId: 'b' } }),
      ).toThrow(HTTPException);
    });
  });
});
