import { knowledgeScopeAddress } from '@mastra/core/knowledge';
import { z } from 'zod';

const identityFieldSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[^\u0000-\u001f\u007f]+$/u);
export const actorIdSchema = identityFieldSchema.refine(
  value => value === value.trim(),
  'Actor ID cannot have leading or trailing whitespace',
);
export const profileSchema = z.object({
  id: identityFieldSchema,
  actorId: actorIdSchema,
  tenantId: identityFieldSchema,
  customerId: identityFieldSchema,
});
export type Profile = z.infer<typeof profileSchema>;

export function validateProfile(profile: Profile): Profile {
  if (!profileSchema.safeParse(profile).success) throw new Error('Invalid local profile');
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
