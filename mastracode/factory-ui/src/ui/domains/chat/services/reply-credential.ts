/** The user whose personal credentials a thread runs on. */
export interface ThreadOwner {
  id: string;
  name?: string;
  avatarUrl?: string;
}

function credentialHolder(
  credentialOwnerId: string | undefined,
  threadOwner: ThreadOwner | undefined,
  viewerId: string | undefined,
): string {
  if (credentialOwnerId === undefined) return 'Organization';
  if (credentialOwnerId === viewerId) return 'Your';
  if (credentialOwnerId === threadOwner?.id && threadOwner.name) return `${threadOwner.name}’s`;
  return 'Personal';
}

/**
 * Names the credential the server stamped on a reply when it answered:
 * `credentialLabel` ("Claude Pro/Max") and, for a personal credential,
 * `credentialOwnerId`. A reply stamped without an owner ran on the
 * organization's credential; an unstamped reply gets no label.
 */
export function replyCredentialLabel(
  metadata: Record<string, unknown>,
  threadOwner: ThreadOwner | undefined,
  viewerId: string | undefined,
): string | undefined {
  const { credentialLabel, credentialOwnerId } = metadata;
  if (typeof credentialLabel !== 'string') return undefined;
  const ownerId = typeof credentialOwnerId === 'string' ? credentialOwnerId : undefined;
  return `${credentialHolder(ownerId, threadOwner, viewerId)} ${credentialLabel}`;
}
