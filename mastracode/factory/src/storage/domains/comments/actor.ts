/**
 * FactoryActorRef — the one author contract for everything a person, agent, or
 * integration writes into a factory (comment rows today; thread-message
 * attribution and agent-authored entries reuse it later).
 *
 * Conventions:
 * - Agent actor ids are `agent:<bindingId>` (the transition-service convention):
 *   a binding id routes back to the live session via run bindings. Audit's
 *   `agent:<threadId>` form diverges; both satisfy `isAgentActor`.
 * - `id` is a namespaced string: only bare WorkOS ids (no `:`) are resolvable
 *   or mentionable. External senders get `<platform>:<externalUserId>` plus a
 *   display snapshot captured at write time.
 */

import type { ChannelAccountLink } from '../channel-identity/base.js';

export type FactoryActorKind = 'user' | 'agent' | 'integration';

/**
 * Superset of core's channel author metadata — deliberately NOT that exact
 * shape: `teamId` lives on the raw platform event (never on the author), and
 * `channel_account_links` keys on `(platform, teamId, userId)`, so ingest must
 * capture it here or the identity is unlinkable.
 */
export interface FactoryActorExternalIdentity {
  platform: string;
  teamId?: string;
  messageId?: string;
  userId: string;
  userName?: string;
  fullName?: string;
  mention?: string;
  isBot?: boolean | 'unknown';
}

export interface FactoryActorRef {
  kind: FactoryActorKind;
  id: string;
  displayName?: string;
  avatarUrl?: string;
  external?: FactoryActorExternalIdentity;
}

export function isMentionableActorId(id: string): boolean {
  return id.length > 0 && !id.includes(':');
}

export function actorFromAuthUser(
  userId: string,
  user?: { name?: string; email?: string; avatarUrl?: string },
): FactoryActorRef {
  const displayName = user?.name?.trim() || user?.email?.trim();
  const avatarUrl = user?.avatarUrl?.trim();
  return {
    kind: 'user',
    id: userId,
    ...(displayName ? { displayName } : {}),
    ...(avatarUrl ? { avatarUrl } : {}),
  };
}

export function actorFromAgentBinding(bindingId: string, displayName?: string): FactoryActorRef {
  return {
    kind: 'agent',
    id: `agent:${bindingId}`,
    ...(displayName ? { displayName } : {}),
  };
}

/**
 * A linked platform sender becomes the linked tenant user; an unlinked one
 * stays a namespaced external identity with its display snapshot.
 */
export function actorFromChannelAuthor(
  external: FactoryActorExternalIdentity,
  link?: Pick<ChannelAccountLink, 'userId'> | null,
): FactoryActorRef {
  const displayName = external.fullName?.trim() || external.userName?.trim();
  return {
    kind: 'user',
    id: link?.userId ?? `${external.platform}:${external.userId}`,
    ...(displayName ? { displayName } : {}),
    external,
  };
}
