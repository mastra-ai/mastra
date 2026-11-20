import { fileURLToPath } from 'node:url';
import type { DatasetConfiguration } from '../mastra/knowledge/seed-manifest.ts';
import { policyReference, supportConfiguration } from './support.ts';
import { integrationProfiles } from './runtime.ts';
import { retailProfiles, exampleProfiles } from './retail-pos/profiles.ts';

const directory = (name: string) => fileURLToPath(new URL(`../../knowledge-datasets/${name}/`, import.meta.url));

/** Placement and policy mappings are trusted application configuration, not manifest-supplied authority. */
export const datasets: Record<string, DatasetConfiguration> = {
  'retail-pos': {
    id: 'retail-pos',
    directory: directory('retail-pos'),
    profiles: exampleProfiles,
    mandatoryPolicies: [
      {
        profileId: 'north-store',
        pageKey: supportConfiguration.policy.pageKey,
        ref: policyReference(exampleProfiles[0]!),
      },
    ],
  },
  'retail-pos-docs': {
    id: 'retail-pos-docs',
    directory: directory('retail-pos'),
    manifestFile: 'docs-manifest.json',
    profiles: retailProfiles,
    mandatoryPolicies: [0, 2].map(index => ({
      profileId: retailProfiles[index]!.id,
      pageKey: `safety-policy-${index}`,
      ref: policyReference(retailProfiles[index]!),
    })),
  },
  'retail-pos-history': {
    id: 'retail-pos-history',
    directory: directory('retail-pos'),
    manifestFile: 'history-manifest.json',
    profiles: retailProfiles,
    mandatoryPolicies: [],
  },
  'software-integration': {
    id: 'software-integration',
    directory: directory('software-integration'),
    profiles: integrationProfiles,
    mandatoryPolicies: [
      {
        profileId: 'integration-team',
        pageKey: 'change-policy',
        ref: policyReference({
          id: 'integration-team',
          actorId: 'morgan',
          tenantId: 'software',
          customerId: 'example-app',
        }),
      },
    ],
  },
};
