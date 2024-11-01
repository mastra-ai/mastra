import React from 'react';

import { getPackageManager } from '@/app/(dashboard)/packages/actions';

export const pkgManagerToCommandMap = {
  npm: 'install',
  yarn: 'add',
  pnpm: 'add',
};

type PkgManagers = keyof typeof pkgManagerToCommandMap;

export const usePackageManager = () => {
  const [packageManager, setPackageManager] = React.useState<PkgManagers>('npm');

  const updatePackageManager = async () => {
    setPackageManager((await getPackageManager()) as PkgManagers);
  };

  return {
    packageManager,
    updatePackageManager,
  };
};
