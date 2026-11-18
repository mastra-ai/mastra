import { createLocalStorageStore } from '@mastra/playground-ui/hooks/use-local-storage-store';

import type { ProviderInfo } from '../../../../api/types';
import { credentialAt } from '../../settings/components/provider-credential';
import type { OnboardingDraftModel } from '../../workspaces/services/onboardingFlow';

/**
 * Factories whose setup page this browser already showed. The page opens by itself once per Factory; after
 * that, a member who skipped it meets the same model step inline where a session would start. The `mastracode`
 * prefix means signing out forgets it, so the next account to sign in here gets its own first visit.
 */
const seenStore = createLocalStorageStore<ReadonlySet<string>>({
  key: 'mastracode.memberSetupSeen',
  defaultValue: new Set(),
  parse: stored => {
    if (!Array.isArray(stored)) throw new Error('Stored member setup visits are not a list');
    return new Set(stored.filter((id): id is string => typeof id === 'string'));
  },
  toJSON: seen => [...seen],
});

export function hasSeenMemberSetup(factoryId: string): boolean {
  return seenStore.read().has(factoryId);
}

export function markMemberSetupSeen(factoryId: string) {
  const seen = seenStore.read();
  if (!seen.has(factoryId)) seenStore.write(new Set([...seen, factoryId]));
}

/**
 * The provider a returning member's personal lane opens on: the one their default model needs when they hold a
 * personal credential for it, else the first provider they hold one for. Without one, the lane opens on the
 * provider list.
 */
export function personalLaneSelection(
  providers: readonly ProviderInfo[] | undefined,
  defaultModelId: string | null | undefined,
): OnboardingDraftModel | undefined {
  const defaultProvider = defaultModelId?.split('/')[0];
  const ordered = [...(providers ?? [])].sort(
    (a, b) => Number(b.provider === defaultProvider) - Number(a.provider === defaultProvider),
  );
  for (const provider of ordered) {
    const method = credentialAt(provider, 'user');
    if (!method) continue;
    const modelId = provider.provider === defaultProvider && defaultModelId ? defaultModelId : '';
    return { providerId: provider.provider, method, modelId };
  }
  return undefined;
}

/**
 * Slack's web client opens the workspace (and channel, when known) the member came from, or hands off to the
 * desktop app when it is installed.
 */
export function slackClientUrl(teamId: string | null | undefined, channelId?: string | null): string {
  if (!teamId) return 'https://app.slack.com/client';
  const channel = channelId ? `/${encodeURIComponent(channelId)}` : '';
  return `https://app.slack.com/client/${encodeURIComponent(teamId)}${channel}`;
}
