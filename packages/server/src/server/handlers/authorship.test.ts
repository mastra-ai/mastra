import { MASTRA_RESOURCE_ID_KEY, RequestContext } from '@mastra/core/request-context';

import { describe, expect, it } from 'vitest';
import { MASTRA_USER_KEY, MASTRA_USER_PERMISSIONS_KEY } from '../constants';

import { HTTPException } from '../http-exception';
import {
  assertOwnership,
  assertExecuteAccess,
  assertReadAccess,
  assertShareAccess,
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
        [MASTRA_USER_KEY]: { id: 'user-xyz' },
      });
      expect(getCallerAuthorId(ctx)).toBe('resource-123');
    });

    it('falls back to user.id when resource id is missing', () => {
      const ctx = ctxWith({ [MASTRA_USER_KEY]: { id: 'user-xyz' } });
      expect(getCallerAuthorId(ctx)).toBe('user-xyz');
    });

    it('returns null when neither is set', () => {
      expect(getCallerAuthorId(new RequestContext())).toBeNull();
    });

    it('returns null when resource id is empty or non-string', () => {
      const ctx = ctxWith({ [MASTRA_RESOURCE_ID_KEY]: '', [MASTRA_USER_KEY]: { id: 123 } });
      expect(getCallerAuthorId(ctx)).toBeNull();
    });
  });

  describe('hasAdminBypass', () => {
    it('grants bypass for `*`', () => {
      const ctx = ctxWith({ [MASTRA_USER_PERMISSIONS_KEY]: ['*'] });
      expect(hasAdminBypass(ctx, 'stored-agents')).toBe(true);
    });

    it('grants bypass for `<resource>:*`', () => {
      const ctx = ctxWith({ [MASTRA_USER_PERMISSIONS_KEY]: ['stored-agents:*'] });
      expect(hasAdminBypass(ctx, 'stored-agents')).toBe(true);
    });

    it('grants bypass for `<resource>:admin`', () => {
      const ctx = ctxWith({ [MASTRA_USER_PERMISSIONS_KEY]: ['stored-agents:admin'] });
      expect(hasAdminBypass(ctx, 'stored-agents')).toBe(true);
    });

    it('denies bypass for unrelated wildcards or read-only perms', () => {
      const ctx = ctxWith({ [MASTRA_USER_PERMISSIONS_KEY]: ['stored-agents:read', 'workflows:*'] });
      expect(hasAdminBypass(ctx, 'stored-agents')).toBe(false);
    });

    it('denies bypass when no permissions are attached', () => {
      expect(hasAdminBypass(new RequestContext(), 'stored-agents')).toBe(false);
    });
  });

  describe('resolveAuthorFilter', () => {
    it('returns unrestricted for admins without a query override', () => {
      const ctx = ctxWith({
        [MASTRA_USER_KEY]: { id: 'admin' },
        [MASTRA_USER_PERMISSIONS_KEY]: ['*'],
      });
      const filter = resolveAuthorFilter({ requestContext: ctx, resource: 'stored-agents' });
      expect(filter).toEqual({ kind: 'unrestricted' });
    });

    it('returns exact filter for admins with ?authorId=', () => {
      const ctx = ctxWith({
        [MASTRA_USER_KEY]: { id: 'admin' },
        [MASTRA_USER_PERMISSIONS_KEY]: ['stored-agents:admin'],
      });
      const filter = resolveAuthorFilter({
        requestContext: ctx,
        resource: 'stored-agents',
        queryAuthorId: 'someone-else',
      });
      expect(filter).toEqual({ kind: 'exact', authorId: 'someone-else' });
    });

    it('returns ownedOrPublic for a plain caller without a query override', () => {
      const ctx = ctxWith({ [MASTRA_USER_KEY]: { id: 'user-1' } });
      const filter = resolveAuthorFilter({ requestContext: ctx, resource: 'stored-agents' });
      expect(filter).toEqual({ kind: 'ownedOrPublic', callerAuthorId: 'user-1' });
    });

    it('returns exact filter when caller queries their own authorId', () => {
      const ctx = ctxWith({ [MASTRA_USER_KEY]: { id: 'user-1' } });
      const filter = resolveAuthorFilter({
        requestContext: ctx,
        resource: 'stored-agents',
        queryAuthorId: 'user-1',
      });
      expect(filter).toEqual({ kind: 'exact', authorId: 'user-1' });
    });

    it("scopes to another author's public records when caller queries someone else's authorId", () => {
      const ctx = ctxWith({ [MASTRA_USER_KEY]: { id: 'user-1' } });
      const filter = resolveAuthorFilter({
        requestContext: ctx,
        resource: 'stored-agents',
        queryAuthorId: 'user-2',
      });
      expect(filter).toEqual({ kind: 'ownedOrPublicOthers', callerAuthorId: 'user-1', queryAuthorId: 'user-2' });
    });

    it('returns publicOnly when ?visibility=public is supplied', () => {
      const ctx = ctxWith({ [MASTRA_USER_KEY]: { id: 'user-1' } });
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
      const ctx = ctxWith({ [MASTRA_USER_PERMISSIONS_KEY]: ['agents:edit'] });
      expect(hasScopedPermission({ requestContext: ctx, resource: 'agents', action: 'edit', resourceId: 'a1' })).toBe(
        false,
      );
    });

    it('matches when caller holds `<resource>:<action>:<resourceId>`', () => {
      const ctx = ctxWith({ [MASTRA_USER_PERMISSIONS_KEY]: ['agents:edit:a1'] });
      expect(hasScopedPermission({ requestContext: ctx, resource: 'agents', action: 'edit', resourceId: 'a1' })).toBe(
        true,
      );
    });

    it('does not match a different resourceId', () => {
      const ctx = ctxWith({ [MASTRA_USER_PERMISSIONS_KEY]: ['agents:edit:a1'] });
      expect(hasScopedPermission({ requestContext: ctx, resource: 'agents', action: 'edit', resourceId: 'a2' })).toBe(
        false,
      );
    });

    it('does not match a different action', () => {
      const ctx = ctxWith({ [MASTRA_USER_PERMISSIONS_KEY]: ['agents:read:a1'] });
      expect(hasScopedPermission({ requestContext: ctx, resource: 'agents', action: 'edit', resourceId: 'a1' })).toBe(
        false,
      );
    });

    it('falls back to broad-grant matching when called without a resourceId', () => {
      const ctx = ctxWith({ [MASTRA_USER_PERMISSIONS_KEY]: ['agents:edit'] });
      expect(hasScopedPermission({ requestContext: ctx, resource: 'agents', action: 'edit' })).toBe(true);
    });
  });

  describe('assertReadAccess', () => {
    it('passes for public records even when caller is not the owner', () => {
      const ctx = ctxWith({ [MASTRA_USER_KEY]: { id: 'someone-else' } });
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
        [MASTRA_USER_KEY]: { id: 'someone-else' },
        [MASTRA_USER_PERMISSIONS_KEY]: ['agents:read:a1'],
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
      const ctx = ctxWith({ [MASTRA_USER_KEY]: { id: 'someone-else' } });
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
        [MASTRA_USER_KEY]: { id: 'someone-else' },
        [MASTRA_USER_PERMISSIONS_KEY]: ['agents:read'],
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

    it('allows access to private owned record when auth is not configured (no caller identity)', () => {
      expect(() =>
        assertReadAccess({
          requestContext: new RequestContext(),
          resource: 'agents',
          resourceId: 'a1',
          record: { authorId: 'owner', visibility: 'private' },
        }),
      ).not.toThrow();
    });
  });

  describe('assertExecuteAccess', () => {
    it('passes for public records even when caller is not the owner', () => {
      const ctx = ctxWith({ [MASTRA_USER_KEY]: { id: 'someone-else' } });
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
        [MASTRA_USER_KEY]: { id: 'someone-else' },
        [MASTRA_USER_PERMISSIONS_KEY]: ['agents:execute:a1'],
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
        [MASTRA_USER_KEY]: { id: 'someone-else' },
        [MASTRA_USER_PERMISSIONS_KEY]: ['agents:read:a1'],
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
      const ctx = ctxWith({ [MASTRA_USER_KEY]: { id: 'someone-else' } });
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
        [MASTRA_USER_KEY]: { id: 'someone-else' },
        [MASTRA_USER_PERMISSIONS_KEY]: ['agents:read', 'agents:execute'],
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
        [MASTRA_USER_KEY]: { id: 'someone-else' },
        [MASTRA_USER_PERMISSIONS_KEY]: ['agents:execute:a2'],
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

    it('allows execution of private owned record when auth is not configured (no caller identity)', () => {
      expect(() =>
        assertExecuteAccess({
          requestContext: new RequestContext(),
          resource: 'agents',
          resourceId: 'a1',
          record: { authorId: 'owner', visibility: 'private' },
        }),
      ).not.toThrow();
    });
  });

  describe('assertWriteAccess', () => {
    it('denies access to public records owned by someone else', () => {
      const ctx = ctxWith({ [MASTRA_USER_KEY]: { id: 'someone-else' } });
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
        [MASTRA_USER_KEY]: { id: 'someone-else' },
        [MASTRA_USER_PERMISSIONS_KEY]: ['agents:edit:a1'],
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
        [MASTRA_USER_KEY]: { id: 'someone-else' },
        [MASTRA_USER_PERMISSIONS_KEY]: ['agents:delete:a1'],
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
        [MASTRA_USER_KEY]: { id: 'someone-else' },
        [MASTRA_USER_PERMISSIONS_KEY]: ['agents:delete:a2'],
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

    it('allows write to private owned record when auth is not configured (no caller identity)', () => {
      expect(() =>
        assertWriteAccess({
          requestContext: new RequestContext(),
          resource: 'agents',
          resourceId: 'a1',
          action: 'edit',
          record: { authorId: 'owner', visibility: 'private' },
        }),
      ).not.toThrow();
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
      const ctx = ctxWith({ [MASTRA_USER_KEY]: { id: 'a' } });
      expect(() =>
        assertOwnership({ requestContext: ctx, resource: 'stored-agents', record: { authorId: 'a' } }),
      ).not.toThrow();
    });

    it('passes with admin bypass regardless of owner', () => {
      const ctx = ctxWith({
        [MASTRA_USER_KEY]: { id: 'admin' },
        [MASTRA_USER_PERMISSIONS_KEY]: ['*'],
      });
      expect(() =>
        assertOwnership({ requestContext: ctx, resource: 'stored-agents', record: { authorId: 'someone' } }),
      ).not.toThrow();
    });

    it('throws 404 on ownership mismatch without bypass', () => {
      const ctx = ctxWith({ [MASTRA_USER_KEY]: { id: 'a' } });
      expect(() =>
        assertOwnership({ requestContext: ctx, resource: 'stored-agents', record: { authorId: 'b' } }),
      ).toThrow(HTTPException);
    });
  });

  describe('assertShareAccess', () => {
    it('passes when the record has no owner (legacy)', () => {
      expect(() =>
        assertShareAccess({
          requestContext: new RequestContext(),
          resource: 'stored-agents',
          record: { authorId: null },
        }),
      ).not.toThrow();
    });

    it('passes when caller owns the record (creator can share their own)', () => {
      const ctx = ctxWith({ [MASTRA_USER_KEY]: { id: 'me' } });
      expect(() =>
        assertShareAccess({
          requestContext: ctx,
          resource: 'stored-agents',
          record: { authorId: 'me', visibility: 'private' },
        }),
      ).not.toThrow();
    });

    it('passes with admin bypass (`*`)', () => {
      const ctx = ctxWith({
        [MASTRA_USER_KEY]: { id: 'admin' },
        [MASTRA_USER_PERMISSIONS_KEY]: ['*'],
      });
      expect(() =>
        assertShareAccess({
          requestContext: ctx,
          resource: 'stored-agents',
          record: { authorId: 'someone', visibility: 'private' },
        }),
      ).not.toThrow();
    });

    it('passes with admin bypass (`<resource>:*`)', () => {
      const ctx = ctxWith({
        [MASTRA_USER_KEY]: { id: 'admin' },
        [MASTRA_USER_PERMISSIONS_KEY]: ['stored-agents:*'],
      });
      expect(() =>
        assertShareAccess({
          requestContext: ctx,
          resource: 'stored-agents',
          record: { authorId: 'someone', visibility: 'private' },
        }),
      ).not.toThrow();
    });

    it('passes when caller holds `<resource>:share`', () => {
      const ctx = ctxWith({
        [MASTRA_USER_KEY]: { id: 'someone-else' },
        [MASTRA_USER_PERMISSIONS_KEY]: ['stored-agents:share'],
      });
      expect(() =>
        assertShareAccess({
          requestContext: ctx,
          resource: 'stored-agents',
          record: { authorId: 'owner', visibility: 'private' },
        }),
      ).not.toThrow();
    });

    it('passes when caller holds `*:share`', () => {
      const ctx = ctxWith({
        [MASTRA_USER_KEY]: { id: 'someone-else' },
        [MASTRA_USER_PERMISSIONS_KEY]: ['*:share'],
      });
      expect(() =>
        assertShareAccess({
          requestContext: ctx,
          resource: 'stored-agents',
          record: { authorId: 'owner', visibility: 'private' },
        }),
      ).not.toThrow();
    });

    it('passes when caller holds scoped `<resource>:share:<id>`', () => {
      const ctx = ctxWith({
        [MASTRA_USER_KEY]: { id: 'someone-else' },
        [MASTRA_USER_PERMISSIONS_KEY]: ['stored-agents:share:a1'],
      });
      expect(() =>
        assertShareAccess({
          requestContext: ctx,
          resource: 'stored-agents',
          resourceId: 'a1',
          record: { authorId: 'owner', visibility: 'private' },
        }),
      ).not.toThrow();
    });

    it('rejects write-only caller (write does NOT imply share)', () => {
      const ctx = ctxWith({
        [MASTRA_USER_KEY]: { id: 'editor' },
        [MASTRA_USER_PERMISSIONS_KEY]: ['stored-agents:write'],
      });
      expect(() =>
        assertShareAccess({
          requestContext: ctx,
          resource: 'stored-agents',
          record: { authorId: 'owner', visibility: 'private' },
        }),
      ).toThrow(HTTPException);
    });

    it('rejects `*:write` caller (action wildcard for write does NOT imply share)', () => {
      const ctx = ctxWith({
        [MASTRA_USER_KEY]: { id: 'editor' },
        [MASTRA_USER_PERMISSIONS_KEY]: ['*:write'],
      });
      expect(() =>
        assertShareAccess({
          requestContext: ctx,
          resource: 'stored-agents',
          record: { authorId: 'owner', visibility: 'private' },
        }),
      ).toThrow(HTTPException);
    });

    it('rejects when record is `public` but caller has no share grant', () => {
      // public visibility does not grant share access — being readable doesn't
      // imply the right to change who else can read.
      const ctx = ctxWith({ [MASTRA_USER_KEY]: { id: 'someone-else' } });
      expect(() =>
        assertShareAccess({
          requestContext: ctx,
          resource: 'stored-agents',
          record: { authorId: 'owner', visibility: 'public' },
        }),
      ).toThrow(HTTPException);
    });

    it('rejects scoped grant for a different resource id', () => {
      const ctx = ctxWith({
        [MASTRA_USER_KEY]: { id: 'someone-else' },
        [MASTRA_USER_PERMISSIONS_KEY]: ['stored-agents:share:a2'],
      });
      expect(() =>
        assertShareAccess({
          requestContext: ctx,
          resource: 'stored-agents',
          resourceId: 'a1',
          record: { authorId: 'owner', visibility: 'private' },
        }),
      ).toThrow(HTTPException);
    });

    it('rejects share grant for a different resource family', () => {
      const ctx = ctxWith({
        [MASTRA_USER_KEY]: { id: 'someone-else' },
        [MASTRA_USER_PERMISSIONS_KEY]: ['stored-skills:share'],
      });
      expect(() =>
        assertShareAccess({
          requestContext: ctx,
          resource: 'stored-agents',
          record: { authorId: 'owner', visibility: 'private' },
        }),
      ).toThrow(HTTPException);
    });

    it('allows sharing of private owned record when auth is not configured (no caller identity)', () => {
      expect(() =>
        assertShareAccess({
          requestContext: new RequestContext(),
          resource: 'stored-agents',
          record: { authorId: 'owner', visibility: 'private' },
        }),
      ).not.toThrow();
    });
  });
});
