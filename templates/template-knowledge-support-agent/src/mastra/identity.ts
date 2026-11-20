import { knowledgeScopeAddress } from '@mastra/core/knowledge';

export interface Profile {
  id: string;
  actorId: string;
  tenantId: string;
  customerId: string;
}

export function validateProfile(profile: Profile): Profile {
  for (const field of ['id', 'actorId', 'tenantId', 'customerId'] as const) {
    if (
      typeof profile[field] !== 'string' ||
      !profile[field].length ||
      profile[field].length > 200 ||
      /[\u0000-\u001f\u007f]/u.test(profile[field])
    ) {
      throw new Error('Invalid local profile');
    }
  }
  return profile;
}

export function resourceId(profile: Profile): string {
  validateProfile(profile);
  return JSON.stringify([profile.tenantId, profile.customerId, profile.actorId]);
}

export function principals(profile: Profile): string[] {
  validateProfile(profile);
  return [
    knowledgeScopeAddress('tenant:$tenantId', { tenantId: profile.tenantId }),
    knowledgeScopeAddress('customer:$tenantId:$customerId', {
      tenantId: profile.tenantId,
      customerId: profile.customerId,
    }),
  ];
}
