/** True for Platform region values served from Europe (`ams`, `eu`, or a `europe-*` GCP region). */
export function isEuRegion(region?: string | null): boolean {
  const normalized = region?.trim().toLowerCase();
  return normalized === 'ams' || normalized === 'eu' || !!normalized?.startsWith('europe-');
}
