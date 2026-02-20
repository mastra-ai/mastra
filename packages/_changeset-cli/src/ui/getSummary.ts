export function getSummary(updatedPackagesList: string[]): string {
  return `Updated packages:${[''].concat(updatedPackagesList).join('\n  - ')}`;
}
