import type { FactoryDevSettings } from './settings.js';

type TokenOwnership = { tokenId: string; organizationId: string };

function uniqueRevocations(revocations: TokenOwnership[]): TokenOwnership[] {
  return [...new Map(revocations.map(item => [`${item.organizationId}:${item.tokenId}`, item])).values()];
}

export function queueTokenRotation(
  settings: FactoryDevSettings,
  tokenId: string,
  organizationId: string,
  previousOwnership?: TokenOwnership,
): void {
  const previous =
    previousOwnership ??
    (settings.auth.tokenId && settings.auth.tokenOrganizationId
      ? { tokenId: settings.auth.tokenId, organizationId: settings.auth.tokenOrganizationId }
      : undefined);

  settings.auth.tokenId = tokenId;
  settings.auth.tokenOrganizationId = organizationId;
  if (previous && (previous.tokenId !== tokenId || previous.organizationId !== organizationId)) {
    settings.auth.pendingRevocations = uniqueRevocations([...(settings.auth.pendingRevocations ?? []), previous]);
  }
}

export function reconcileTokenOwnership(settings: FactoryDevSettings, persisted: TokenOwnership): boolean {
  if (settings.auth.tokenId === persisted.tokenId && settings.auth.tokenOrganizationId === persisted.organizationId) {
    return false;
  }

  const displaced =
    settings.auth.tokenId && settings.auth.tokenOrganizationId
      ? { tokenId: settings.auth.tokenId, organizationId: settings.auth.tokenOrganizationId }
      : undefined;
  settings.auth.tokenId = persisted.tokenId;
  settings.auth.tokenOrganizationId = persisted.organizationId;
  settings.auth.pendingRevocations = uniqueRevocations(
    [...(settings.auth.pendingRevocations ?? []), ...(displaced ? [displaced] : [])].filter(
      item => item.tokenId !== persisted.tokenId || item.organizationId !== persisted.organizationId,
    ),
  );
  if (settings.auth.pendingRevocations.length === 0) delete settings.auth.pendingRevocations;
  return true;
}

export async function retryPendingTokenRevocations(
  settings: FactoryDevSettings,
  revoke: (ownership: TokenOwnership) => Promise<void>,
  persist: () => Promise<void>,
): Promise<Error[]> {
  const failures: Error[] = [];
  const pending = settings.auth.pendingRevocations ?? [];

  for (const ownership of pending) {
    const isCurrent =
      ownership.tokenId === settings.auth.tokenId && ownership.organizationId === settings.auth.tokenOrganizationId;
    if (!isCurrent) {
      try {
        await revoke(ownership);
      } catch (error) {
        failures.push(error instanceof Error ? error : new Error(String(error)));
        continue;
      }
    }

    settings.auth.pendingRevocations = settings.auth.pendingRevocations?.filter(
      item => item.tokenId !== ownership.tokenId || item.organizationId !== ownership.organizationId,
    );
    if (settings.auth.pendingRevocations?.length === 0) delete settings.auth.pendingRevocations;
    await persist();
  }

  return failures;
}
