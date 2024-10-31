import React from 'react';

import { installPackage, isPackageInstalled } from '@/app/(dashboard)/packages/actions';

export const useInstallPackage = ({
  packageName,
  updatePkgManager,
}: {
  packageName: string;
  updatePkgManager: () => void;
}) => {
  const [integrationPkg, setIntegrationPkg] = React.useState<{ name: string; isInstalled: boolean }>({
    name: '',
    isInstalled: false,
  });

  React.useEffect(() => {
    (async () => {
      const isInstalled = await isPackageInstalled({ packageName });
      setIntegrationPkg({
        name: packageName,
        isInstalled,
      });
    })();
  }, [packageName]);

  const handleInstallPackage = async (packageName: string) => {
    const res = await installPackage({ packageName });

    if (!res.ok) return false;

    setIntegrationPkg(prev => ({
      ...prev,
      name: packageName,
      isInstalled: true,
    }));

    return true;
  };

  const handlePackage = async () => {
    if (!integrationPkg.isInstalled) {
      updatePkgManager();
    }
  };

  return {
    integrationPkg,
    setIntegrationPkg,
    handleInstallPackage,
    handlePackage,
  };
};
