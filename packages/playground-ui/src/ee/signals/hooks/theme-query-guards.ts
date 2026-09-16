export function isNumericThemeId(themeId: string | undefined): themeId is string {
  return themeId !== undefined && /^\d+$/.test(themeId);
}

export function requireNumericThemeId(themeId: string | undefined) {
  if (!isNumericThemeId(themeId)) throw new Error('A numeric theme id is required');
  return themeId;
}

export function requireSnapshotId(snapshotId: string | undefined) {
  if (!snapshotId) throw new Error('A theme snapshot is required');
  return snapshotId;
}
