'use client';

import React from 'react';

import { useRouter, useSearchParams } from 'next/navigation';

import { isPackageInstalled } from '../../../app/(dashboard)/packages/actions';

export const useCheckPackageInstallation = ({
  integrationPackage,
  redirectUrl,
}: {
  integrationPackage: string;
  redirectUrl: string;
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const packageName = searchParams.get('package');

  const checkIfPackageIsInstalled = async () => {
    const isInstalled = await isPackageInstalled({ packageName: integrationPackage });
    return isInstalled;
  };

  React.useEffect(() => {
    if (!packageName) return;

    if (integrationPackage !== packageName) {
      return;
    }

    const performInstallationCheck = async () => {
      const isInstalled = await checkIfPackageIsInstalled();

      if (isInstalled) {
        return router.push(redirectUrl);
      } else {
        performInstallationCheck();
      }
    };

    performInstallationCheck();
  }, [packageName]);
};
