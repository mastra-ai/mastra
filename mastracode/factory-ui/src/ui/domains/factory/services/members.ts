import type { FactoryRosterMember } from '@mastra/factory/storage/domains/comments/domain';

import { requestJson } from './request';

export type FactoryMentionMember = FactoryRosterMember;

export async function fetchMentionRoster(
  baseUrl: string,
  factoryProjectId: string,
  signal?: AbortSignal,
): Promise<FactoryMentionMember[]> {
  const data = await requestJson<{ members: FactoryMentionMember[] }>(
    `${baseUrl}/web/factory/projects/${encodeURIComponent(factoryProjectId)}/mention-roster`,
    { signal },
  );
  return data.members;
}
