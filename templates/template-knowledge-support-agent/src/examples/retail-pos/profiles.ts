import type { Profile } from '../../mastra/identity.ts';

export const exampleStudioRole = 'technician';

export const exampleProfiles: Profile[] = [
  { id: 'north-store', actorId: 'alex', tenantId: 'north', customerId: 'store-1' },
  { id: 'north-other', actorId: 'alex', tenantId: 'north', customerId: 'store-2' },
  { id: 'south-store', actorId: 'sam', tenantId: 'south', customerId: 'store-1' },
  { id: 'north-colleague', actorId: 'lee', tenantId: 'north', customerId: 'store-1' },
];
