import type { IUserProvider } from '@mastra/core/auth';
import type { MastraAuthProvider } from '@mastra/core/server';

import { HTTPException } from '../http-exception';

/**
 * Returns the authenticated user's id if the server is configured with a
 * `MastraAuthProvider` that implements `getCurrentUser`. Returns `null` when no
 * auth is configured — callers should treat this as "ownership checks disabled"
 * to preserve behavior for setups that don't have an auth provider.
 */
export async function getCurrentUserIdIfAuthed(mastra: any, request: Request | undefined): Promise<string | null> {
  const serverConfig = mastra?.getServer?.();
  const auth = serverConfig?.auth as MastraAuthProvider | undefined;
  if (!auth || typeof (auth as any).authenticateToken !== 'function') return null;
  if (typeof (auth as unknown as IUserProvider).getCurrentUser !== 'function') return null;
  if (!request) return null;
  const user = await (auth as unknown as IUserProvider).getCurrentUser(request);
  return user?.id ?? null;
}

/**
 * Enforce that the authenticated user owns a record with an `authorId`. Only
 * runs when:
 *   - the server has an auth provider with `getCurrentUser`, AND
 *   - the record has an `authorId`.
 *
 * Skips for unauthenticated setups so existing single-tenant installs keep
 * working.
 */
export async function assertRecordOwnership(params: {
  mastra: any;
  request: Request | undefined;
  record: { authorId?: string | null } | null | undefined;
  resourceLabel: string;
}): Promise<void> {
  const { mastra, request, record, resourceLabel } = params;
  if (!record?.authorId) return;
  const currentUserId = await getCurrentUserIdIfAuthed(mastra, request);
  if (currentUserId === null) return;
  if (currentUserId !== record.authorId) {
    throw new HTTPException(403, { message: `You are not the author of this ${resourceLabel}` });
  }
}
