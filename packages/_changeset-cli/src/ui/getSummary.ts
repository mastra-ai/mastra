interface UpdatedPeerDependencies {
  directUpdatedPackages: string[];
  indirectUpdatedPackages: string[];
}

export function getSummary(updatedPackagesList: string[], updatedPeerDeps: UpdatedPeerDependencies): string {
  let summaryOutput = '';
  summaryOutput += `Updated packages:${[''].concat(updatedPackagesList).join('\n  - ')}`;

  if (updatedPeerDeps.directUpdatedPackages.length > 0 || updatedPeerDeps.indirectUpdatedPackages.length > 0) {
    summaryOutput += '\n\nPeer dependencies:';
  }

  if (updatedPeerDeps.directUpdatedPackages.length > 0) {
    const directUpdatedPackagesList = updatedPeerDeps.directUpdatedPackages.map(pkg => `${pkg}: minor`);
    summaryOutput += `${[''].concat(directUpdatedPackagesList).join('\n  - ')}`;
  }
  if (updatedPeerDeps.indirectUpdatedPackages.length > 0) {
    const indirectUpdatedPackagesList = updatedPeerDeps.indirectUpdatedPackages.map(pkg => `${pkg}: patch`);
    summaryOutput += `${[''].concat(indirectUpdatedPackagesList).join('\n  - ')}`;
  }

  return summaryOutput;
}
