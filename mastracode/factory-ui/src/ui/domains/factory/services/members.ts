import { requestJson } from './request';

export interface FactoryMentionMember {
  id: string;
  name?: string;
  avatarUrl?: string;
}

function isMentionMember(value: unknown): value is FactoryMentionMember {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return (
    'id' in value &&
    typeof value.id === 'string' &&
    (!('name' in value) || value.name === undefined || typeof value.name === 'string') &&
    (!('avatarUrl' in value) || value.avatarUrl === undefined || typeof value.avatarUrl === 'string')
  );
}

export async function fetchMentionRoster(
  baseUrl: string,
  factoryProjectId: string,
  signal?: AbortSignal,
): Promise<FactoryMentionMember[]> {
  const data = await requestJson<unknown>(
    `${baseUrl}/web/factory/projects/${encodeURIComponent(factoryProjectId)}/mention-roster`,
    { signal },
  );
  if (typeof data !== 'object' || data === null || !('members' in data) || !Array.isArray(data.members)) {
    throw new Error('Unexpected mention roster response shape');
  }
  return data.members.filter(isMentionMember);
}
