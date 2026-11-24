/** True for Platform region values served from Europe (`ams`, `eu`, or a `europe-*` GCP region). */
export function isEuRegion(region?: string | null): boolean {
  const normalized = region?.trim().toLowerCase();
  return normalized === 'ams' || normalized === 'eu' || !!normalized?.startsWith('europe-');
}

/** Regions accepted by `mastra deploy --region`: the `us`/`eu` shorthands and the canonical Railway regions. */
export const DEPLOY_REGIONS = ['us', 'eu', 'pdx', 'iad', 'sfo', 'ams'] as const;

export type DeployRegion = (typeof DEPLOY_REGIONS)[number];

export function isDeployRegion(region: string): region is DeployRegion {
  return (DEPLOY_REGIONS as readonly string[]).includes(region);
}
