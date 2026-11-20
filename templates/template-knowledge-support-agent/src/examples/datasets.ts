import { fileURLToPath } from 'node:url';
import type { DatasetConfiguration } from '../mastra/knowledge/seed-manifest.ts';
import { exampleProfiles } from './retail-pos/profiles.ts';

const directory = (name: string) => fileURLToPath(new URL(`../../knowledge-datasets/${name}/`, import.meta.url));

/** Placement and policy mappings are trusted application configuration, not manifest-supplied authority. */
export const datasets: Record<string, DatasetConfiguration> = {
  'retail-pos': {
    id: 'retail-pos',
    directory: directory('retail-pos'),
    profiles: exampleProfiles,
    mandatoryPolicies: [{ profileId: 'north-store', pageKey: 'safety-policy' }],
  },
  'software-integration': {
    id: 'software-integration',
    directory: directory('software-integration'),
    profiles: [{ id: 'integration-team', actorId: 'morgan', tenantId: 'software', customerId: 'example-app' }],
    mandatoryPolicies: [{ profileId: 'integration-team', pageKey: 'change-policy' }],
  },
};
