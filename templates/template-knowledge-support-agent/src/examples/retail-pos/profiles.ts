import type { Profile } from '../../mastra/identity.ts';

export const exampleStudioRole = 'technician';

export const exampleReviewers: Profile[] = [
  { id: 'north-reviewer', actorId: 'morgan', tenantId: 'north', customerId: 'store-1' },
  { id: 'retailops-reviewer', actorId: 'morgan', tenantId: 'retailops', customerId: 'store-42' },
];

export const exampleProfiles: Profile[] = [
  { id: 'north-store', actorId: 'alex', tenantId: 'north', customerId: 'store-1' },
  { id: 'north-other', actorId: 'alex', tenantId: 'north', customerId: 'store-2' },
  { id: 'south-store', actorId: 'sam', tenantId: 'south', customerId: 'store-1' },
  { id: 'north-colleague', actorId: 'lee', tenantId: 'north', customerId: 'store-1' },
];

/** Canonical demo identities are additive; legacy tuples and ordering remain stable. */
export const retailProfiles: Profile[] = [
  { id: 'retailops-store-42', actorId: 'alex', tenantId: 'retailops', customerId: 'store-42' },
  { id: 'retailops-store-73', actorId: 'riley', tenantId: 'retailops', customerId: 'store-73' },
  { id: 'fieldretail-store-42', actorId: 'sam', tenantId: 'fieldretail', customerId: 'store-42' },
  { id: 'retailops-colleague', actorId: 'lee', tenantId: 'retailops', customerId: 'store-42' },
];
